import { timingSafeEqual } from "node:crypto";
import { adminFeaturesEnabled } from "./siteMode.ts";

export function isAdminRequest(request: { headers: Headers }) {
  if (!adminFeaturesEnabled()) return false;
  const expected = process.env.ADMIN_PASSWORD?.trim();
  const supplied = request.headers.get("x-admin-password")?.trim();
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected), b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}
