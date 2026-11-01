import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { STORAGE_DRIVER, S3_BUCKET, S3_PREFIX, AWS_REGION, S3_ENDPOINT, UPLOADS_DIR } from "../config.js";

// Every uploaded file is referenced in the database by a path like
// "/uploads/posts/<uuid>.jpg". That path is the same whichever driver is
// used, so switching between local disk and S3 never changes stored data.

export const usingS3 = STORAGE_DRIVER === "s3";

if (!["local", "s3"].includes(STORAGE_DRIVER)) {
  throw new Error(`STORAGE_DRIVER must be "local" or "s3" (got "${STORAGE_DRIVER}").`);
}
if (usingS3 && !S3_BUCKET) {
  throw new Error("STORAGE_DRIVER=s3 needs S3_BUCKET to be set.");
}

// Credentials are NOT configured here. On EC2 the SDK picks them up
// automatically from the instance's IAM role, so no keys live in the code.
const s3 = usingS3
  ? new S3Client({
      region: AWS_REGION,
      // Send plain request bodies (no aws-chunked checksum trailers). S3 accepts
      // both; plain bodies also work with S3 compatible test servers, so the
      // code path tested locally is exactly the one used on AWS.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      ...(S3_ENDPOINT ? { endpoint: S3_ENDPOINT, forcePathStyle: true } : {}),
    })
  : null;

const CONTENT_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};
const contentTypeFor = (name) => CONTENT_TYPES[path.extname(name).toLowerCase()] || "application/octet-stream";

/** "/uploads/posts/a.png" -> "uploads/posts/a.png" (S3 object key). */
export function keyFor(url) {
  const relative = url.replace(/^\/uploads\//, "");
  if (!relative || relative.includes("..")) throw new Error("Invalid upload path.");
  return `${S3_PREFIX}${relative}`;
}

const localPathFor = (url) => path.join(UPLOADS_DIR, url.replace(/^\/uploads\//, ""));

/**
 * Express middleware placed right after multer. With the S3 driver it moves
 * the uploaded file(s) from the temporary local copy into the bucket.
 */
export async function persistUploads(req, res, next) {
  if (!usingS3) return next();
  const files = req.file ? [req.file] : Array.isArray(req.files) ? req.files : [];
  try {
    for (const file of files) {
      const folder = path.basename(path.dirname(file.path));
      const url = `/uploads/${folder}/${file.filename}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: keyFor(url),
          Body: fs.createReadStream(file.path),
          ContentLength: file.size,
          ContentType: contentTypeFor(file.filename),
          CacheControl: "public, max-age=604800, immutable",
        })
      );
      await fs.promises.unlink(file.path).catch(() => {});
    }
    next();
  } catch (err) {
    await Promise.all(files.map((f) => fs.promises.unlink(f.path).catch(() => {})));
    next(err);
  }
}

/** Delete a stored file (story media, ...). Never throws. */
export async function removeUpload(url) {
  if (!url || !url.startsWith("/uploads/")) return;
  try {
    if (usingS3) {
      await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: keyFor(url) }));
    } else {
      await fs.promises.unlink(localPathFor(url));
    }
  } catch {
    /* already gone */
  }
}

/**
 * Serves GET /uploads/*. Local driver: files from disk. S3 driver: the file
 * is streamed from the PRIVATE bucket through the API, so the bucket never
 * needs public access. Range requests are passed on so videos can seek.
 */
export function serveUploads(staticHandler) {
  return async (req, res, next) => {
    if (!usingS3) return staticHandler(req, res, next);
    if (req.method !== "GET" && req.method !== "HEAD") return next();

    let key;
    try {
      key = keyFor(`/uploads${decodeURIComponent(req.path)}`);
    } catch {
      return res.status(400).end();
    }

    try {
      const obj = await s3.send(
        new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
          ...(req.headers.range ? { Range: req.headers.range } : {}),
          ...(req.headers["if-none-match"] ? { IfNoneMatch: req.headers["if-none-match"] } : {}),
        })
      );
      res.status(obj.ContentRange ? 206 : 200);
      res.set({
        "Content-Type": obj.ContentType || contentTypeFor(key),
        "Cache-Control": obj.CacheControl || "public, max-age=604800",
        "Accept-Ranges": "bytes",
        ...(obj.ContentLength !== undefined ? { "Content-Length": String(obj.ContentLength) } : {}),
        ...(obj.ContentRange ? { "Content-Range": obj.ContentRange } : {}),
        ...(obj.ETag ? { ETag: obj.ETag } : {}),
        ...(obj.LastModified ? { "Last-Modified": obj.LastModified.toUTCString() } : {}),
      });
      if (req.method === "HEAD") {
        obj.Body?.destroy?.();
        return res.end();
      }
      await pipeline(obj.Body, res);
    } catch (err) {
      const status = err?.$metadata?.httpStatusCode;
      if (status === 304) return res.status(304).end();
      if (status === 404 || err?.name === "NoSuchKey" || err?.name === "NotFound") return res.status(404).end();
      if (status === 416) return res.status(416).end();
      if (!res.headersSent) return next(err);
      res.destroy(err);
    }
  };
}

/**
 * The demo seed refers to a few bundled images (/uploads/posts/seed-*.png).
 * With S3, copy any that are missing into the bucket on startup.
 */
export async function syncSeedFiles() {
  if (!usingS3) return 0;
  const dir = path.join(UPLOADS_DIR, "posts");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.startsWith("seed-")) : [];
  let uploaded = 0;
  for (const name of files) {
    const url = `/uploads/posts/${name}`;
    try {
      await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: keyFor(url) }));
    } catch {
      const full = path.join(dir, name);
      await s3.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: keyFor(url),
          Body: fs.createReadStream(full),
          ContentLength: fs.statSync(full).size,
          ContentType: contentTypeFor(name),
        })
      );
      uploaded++;
    }
  }
  return uploaded;
}

/** For /api/health: can the API reach the bucket? */
export async function checkStorage() {
  if (!usingS3) return "local";
  try {
    await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: `${S3_PREFIX}posts/seed-cafe-interior.png` }));
    return "s3-connected";
  } catch (err) {
    return err?.$metadata?.httpStatusCode === 404 ? "s3-connected" : "s3-unreachable";
  }
}
