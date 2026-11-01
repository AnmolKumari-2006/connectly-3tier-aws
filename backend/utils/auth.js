import bcrypt from "bcryptjs";

// Async bcrypt so hashing never blocks other requests on the API server.
export function hashPassword(raw) {
  return bcrypt.hash(raw, 10);
}

export function checkPassword(raw, hash) {
  return bcrypt.compare(raw, hash);
}
