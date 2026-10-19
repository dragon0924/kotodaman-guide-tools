import { createHash } from "node:crypto";
import { MEDIA_ID, MEDIA_WIDTHS } from "../articleMedia.ts";
import { mediaContentType, type ArticleMediaStorage } from "./articleMedia.ts";
import { readMediaManifest } from "./articleImageOptimization.ts";

/** Authorization happens before manifest reads, object reads, and conditional responses. */
export async function articleMediaResponse(request: Request, id: string, options: { admin: boolean; isPublic: () => Promise<boolean>; storage: () => ArticleMediaStorage }) {
  const denied = () => new Response("Not found", { status: 404, headers: { "cache-control": "private, no-store", vary: "x-admin-password" } });
  if (!MEDIA_ID.test(id)) return denied();
  if (!options.admin && !await options.isPublic()) return denied();
  const query = new URL(request.url).searchParams, width = query.get("w");
  if ([...query.keys()].some(k => k !== "w") || query.getAll("w").length > 1 || width !== null && !MEDIA_WIDTHS.some(w => String(w) === width)) return new Response("Invalid image size", { status: 400, headers: { "cache-control": "private, no-store" } });
  try {
    const storage = options.storage(), metadata = await readMediaManifest(storage, id);
    const asset = metadata && width ? [...metadata.variants, metadata.master].sort((a, b) => a.width - b.width).find(v => v.width >= Number(width)) ?? metadata.master : metadata?.master;
    const key = asset?.key ?? id;
    const bytes = await storage.get(key);
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (asset && (asset.bytes !== bytes.length || asset.sha256 !== digest)) return denied();
    const headers = new Headers({ "content-type": mediaContentType(key), "cache-control": options.admin ? "private, no-store" : "private, no-cache, max-age=0, must-revalidate", vary: "x-admin-password", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox", etag: '"' + digest + '"' });
    if (asset) { headers.set("x-image-width", String(asset.width)); headers.set("x-image-height", String(asset.height)); }
    if (!options.admin && request.headers.get("if-none-match") === headers.get("etag")) return new Response(null, { status: 304, headers });
    headers.set("content-length", String(bytes.length));
    return new Response(new Uint8Array(bytes), { headers });
  } catch { return denied(); }
}
