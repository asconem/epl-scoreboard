import crypto from "crypto";

export function adminToken() {
  const pw = process.env.ADMIN_PASSWORD || "";
  return crypto.createHash("sha256").update(pw + ":epl-pool-v1").digest("hex");
}

export function isAdmin(cookieValue) {
  if (!process.env.ADMIN_PASSWORD || !cookieValue) return false;
  const expected = adminToken();
  const a = Buffer.from(cookieValue);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
