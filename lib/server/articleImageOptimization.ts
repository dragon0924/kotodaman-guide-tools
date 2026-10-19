import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { MEDIA_ID, MEDIA_PURPOSES, MEDIA_WIDTHS, type MediaPurpose } from "../articleMedia.ts";
import type { ArticleMediaStorage } from "./articleMedia.ts";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
type Format = "webp" | "png" | "jpg";
type PreparedAsset = { bytes: Buffer; width: number; height: number; format: Format };
type Asset = { key: string; width: number; height: number; bytes: number; format: Format; sha256: string };
export type MediaManifest = {
  version: 1; id: string; purpose: MediaPurpose; createdAt: string;
  master: Asset; variants: Asset[];
  source: { format: string; width: number; height: number; bytes: number; sha256: string; key?: string };
};
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
// Remove EXIF/XMP/IPTC/comments without recompressing pixels. Keep ICC/Adobe colour markers.
function stripJpeg(bytes: Buffer) {
  const parts = [bytes.subarray(0, 2)]; let p = 2;
  while (p < bytes.length) {
    const start = p;
    if (bytes[p++] !== 255) throw new Error("JPEGの構造が不正です。");
    while (bytes[p] === 255) p++;
    const marker = bytes[p++];
    if (marker === 218 || marker === 217) { parts.push(bytes.subarray(start)); break; }
    if (marker === 1 || marker >= 208 && marker <= 215) { parts.push(bytes.subarray(start, p)); continue; }
    const length = bytes.readUInt16BE(p); if (length < 2 || p + length > bytes.length) throw new Error("JPEGの構造が不正です。");
    if (![225, 237, 254].includes(marker)) parts.push(bytes.subarray(start, p + length));
    p += length;
  }
  return Buffer.concat(parts);
}
function stripWebp(bytes: Buffer) {
  const chunks: Buffer[] = []; let p = 12;
  while (p + 8 <= bytes.length) {
    const type = bytes.toString("ascii", p, p + 4), size = bytes.readUInt32LE(p + 4), end = p + 8 + size + (size % 2);
    if (end > bytes.length) throw new Error("WebPの構造が不正です。");
    if (!["EXIF", "XMP "].includes(type)) { const chunk = Buffer.from(bytes.subarray(p, end)); if (type === "VP8X") chunk[8] &= ~12; chunks.push(chunk); }
    p = end;
  }
  const out = Buffer.concat([Buffer.from("RIFF0000WEBP", "ascii"), ...chunks]); out.writeUInt32LE(out.length - 8, 4); return out;
}
function animatedPng(bytes: Buffer) {
  let p = 8; while (p + 12 <= bytes.length) { const size = bytes.readUInt32BE(p); if (bytes.toString("ascii", p + 4, p + 8) === "acTL") return true; p += size + 12; } return false;
}
export async function prepareArticleImage(bytes: Buffer, purpose: MediaPurpose = "article") {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error("画像は10MB以下で指定してください。");
  if (!MEDIA_PURPOSES.includes(purpose)) throw new Error("画像用途が不正です。");
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  const avif = bytes.toString("ascii", 4, 8) === "ftyp" && /avi[fs]/u.test(bytes.toString("ascii", 8, 64));
  if (!jpeg && !png && !webp && !avif) throw new Error("静止画のJPEG・PNG・WebP・AVIFを指定してください。SVG・GIF・HEICは未対応です。");
  const input = sharp(bytes, { limitInputPixels: 40000000, failOn: "error" });
  const metadata = await input.metadata();
  if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") && !(avif && metadata.format === "heif" && metadata.compression === "av1") || (metadata.pages ?? 1) > 1 || png && animatedPng(bytes)) throw new Error("アニメーション画像は使用できません。静止画を指定してください。");
  const rotated = input.clone().rotate();
  const lossless = await rotated.clone().webp({ lossless: true, effort: 4 }).toBuffer({ resolveWithObject: true });
  let master: PreparedAsset = { bytes: lossless.data, width: lossless.info.width, height: lossless.info.height, format: "webp" };
  let alternative: Buffer; let format: Format = "png";
  if (jpeg && (!metadata.orientation || metadata.orientation === 1)) { alternative = stripJpeg(bytes); format = "jpg"; }
  else if (webp && (!metadata.orientation || metadata.orientation === 1)) { alternative = stripWebp(bytes); format = "webp"; }
  else if (jpeg) { alternative = await rotated.clone().jpeg({ quality: 96, chromaSubsampling: "4:4:4" }).toBuffer(); format = "jpg"; }
  else { alternative = await rotated.clone().png({ compressionLevel: 9 }).toBuffer(); }
  if (alternative.length < master.bytes.length) master = { ...master, bytes: alternative, format };
  const widths = purpose === "icon" ? [160, 320] : purpose === "thumbnail" ? [160, 320, 640] : [...MEDIA_WIDTHS];
  const variants: PreparedAsset[] = [];
  for (const width of widths.filter(w => w < master.width)) {
    const resized = rotated.clone().resize({ width, withoutEnlargement: true });
    const losslessVariant = !jpeg || purpose === "screenshot" || purpose === "icon";
    const v = await resized.webp(losslessVariant ? { lossless: true, effort: 4 } : { quality: 92, smartSubsample: true }).toBuffer({ resolveWithObject: true });
    if (v.data.length < master.bytes.length) variants.push({ bytes: v.data, width: v.info.width, height: v.info.height, format: "webp" });
  }
  return { ...master, variants, source: { format: jpeg ? "jpg" : png ? "png" : webp ? "webp" : "avif", width: metadata.width!, height: metadata.height!, bytes: bytes.length, sha256: hash(bytes) } };
}
export async function saveArticleImage(storage: ArticleMediaStorage, source: Buffer, purpose: MediaPurpose = "article") {
  const image = await prepareArticleImage(source, purpose), uuid = randomUUID(), id = uuid + "." + image.format;
  const asset = (key: string, v: PreparedAsset): Asset => ({ key, width: v.width, height: v.height, bytes: v.bytes.length, format: v.format, sha256: hash(v.bytes) });
  const sourceKey = process.env.ARTICLE_MEDIA_RETAIN_SOURCE === "0" ? undefined : uuid + ".source." + image.source.format;
  const manifest: MediaManifest = { version: 1, id, purpose, createdAt: new Date().toISOString(), master: asset(id, image), variants: image.variants.map(v => asset(uuid + ".w" + v.width + "." + v.format, v)), source: { ...image.source, ...(sourceKey ? { key: sourceKey } : {}) } };
  const objects = [...(sourceKey ? [{ key: sourceKey, bytes: source }] : []), { key: id, bytes: image.bytes }, ...image.variants.map((v, i) => ({ key: manifest.variants[i].key, bytes: v.bytes })), { key: uuid + ".meta.json", bytes: Buffer.from(JSON.stringify(manifest)) }];
  const written: string[] = [];
  try { for (const object of objects) { await storage.put(object.key, object.bytes); written.push(object.key); } }
  catch (error) { const cleanup = await Promise.allSettled(written.map(key => storage.remove(key))); if (cleanup.some(r => r.status === "rejected")) throw new Error("画像の保存と復旧に失敗しました。未参照画像の確認が必要です。", { cause: error }); throw error; }
  return manifest;
}
export async function readMediaManifest(storage: ArticleMediaStorage, id: string): Promise<MediaManifest | null> {
  if (!MEDIA_ID.test(id)) throw new Error("画像IDが不正です。");
  let bytes: Buffer; try { bytes = await storage.get(id.replace(/\.[^.]+$/u, ".meta.json")); } catch (e) { if (e && typeof e === "object" && "code" in e && e.code === "ENOENT") return null; throw e; }
  const m = JSON.parse(bytes.toString()) as MediaManifest, prefix = id.replace(/\.[^.]+$/u, "");
  const valid = (a: Asset, master = false) => a && a.key === (master ? id : prefix + ".w" + a.width + "." + a.format) && ["jpg", "png", "webp"].includes(a.format) && a.key.endsWith("." + a.format) && Number.isInteger(a.width) && a.width > 0 && Number.isInteger(a.height) && a.height > 0 && a.width * a.height <= 40000000 && Number.isSafeInteger(a.bytes) && a.bytes > 0 && /^[a-f0-9]{64}$/u.test(a.sha256);
  if (m.version !== 1 || m.id !== id || !valid(m.master, true) || !Array.isArray(m.variants) || m.variants.length > 6 || !m.variants.every(a => valid(a) && MEDIA_WIDTHS.includes(a.width as typeof MEDIA_WIDTHS[number]))) throw new Error("画像メタデータが不正です。");
  return m;
}
