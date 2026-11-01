import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { UPLOADS_DIR } from "../config.js";
import { persistUploads } from "./storage.js";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const VIDEO_EXT = new Set([".mp4", ".webm", ".mov"]);

function storageFor(subfolder) {
  // Make sure the target folder exists (e.g. uploads/stories on an older
  // checkout) — multer's diskStorage won't create it for us.
  fs.mkdirSync(path.join(UPLOADS_DIR, subfolder), { recursive: true });
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(UPLOADS_DIR, subfolder)),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });
}

// Multer first writes the file to UPLOADS_DIR; persistUploads then moves it
// to S3 when STORAGE_DRIVER=s3 (and does nothing for local storage).
// Routes keep using upload.single("field") / upload.array("field", n).
function withStorage(upload) {
  return {
    single: (field) => [upload.single(field), persistUploads],
    array: (field, max) => [upload.array(field, max), persistUploads],
  };
}

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext)) return cb(null, true);
  cb(new Error("Unsupported file type. Allowed: JPG, PNG, GIF, WEBP, MP4, WEBM, MOV."));
}

export const uploadAvatar = withStorage(
  multer({ storage: storageFor("avatars"), fileFilter, limits: { fileSize: 8 * 1024 * 1024 } })
);

export const uploadCover = withStorage(
  multer({ storage: storageFor("covers"), fileFilter, limits: { fileSize: 8 * 1024 * 1024 } })
);

export const uploadPostMedia = withStorage(
  multer({ storage: storageFor("posts"), fileFilter, limits: { fileSize: 40 * 1024 * 1024 } })
);

export const uploadStoryMedia = withStorage(
  multer({ storage: storageFor("stories"), fileFilter, limits: { fileSize: 40 * 1024 * 1024 } })
);

export function mediaType(filename) {
  const ext = path.extname(filename).toLowerCase();
  return VIDEO_EXT.has(ext) ? "video" : "image";
}
