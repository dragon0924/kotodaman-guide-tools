import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeArticleFile } from "../articleStore.ts";
import { isPublicArticle, assertEventArticle } from "../articleEvents.ts";
import { assertQuestArticle } from "../questArticle.ts";
import { articleImageSources, safeArticleImageUrl, validateArticleRichContent } from "../articleRichText.ts";
import { MEDIA_ID } from "../articleMedia.ts";
import { readMediaManifest } from "./articleImageOptimization.ts";
import type { Article } from "../types";
import type { ArticleMediaStorage } from "./articleMedia.ts";

const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const inside = (parent: string, child: string) => { const relative = path.relative(parent, child); return !relative.startsWith("..") && !path.isAbsolute(relative); };

/** Explicitly published and reviewed content only; no editor-only root fields. */
export function publicArticleProjection(articles: Article[]) {
  const keys = ["id", "title", "type", "status", "slug", "summary", "sections", "createdAt", "updatedAt", "event", "quest", "coverImage", "toc", "editHistory", "contentReviewed", "publishedOn"] as const;
  const selected = articles.filter(isPublicArticle);
  const ids = new Set<string>(), slugs = new Set<string>();
  return selected.map(article => {
    if (!article.id || ids.has(article.id) || !article.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(article.slug) || slugs.has(article.slug)) throw new Error("公開記事のID・URLが不正または重複しています。");
    ids.add(article.id); slugs.add(article.slug);
    assertEventArticle(article); assertQuestArticle(article); validateArticleRichContent(article);
    return structuredClone(Object.fromEntries(keys.filter(key => article[key] !== undefined).map(key => [key, article[key]]))) as Article;
  });
}

export async function exportPublicContent(options: { sourceFile: string; outputDirectory: string; storage: ArticleMediaStorage; articleIds?: string[] }) {
  const sourceFile = path.resolve(options.sourceFile), output = path.resolve(options.outputDirectory);
  if (inside(path.resolve("public"), output) || inside(output, sourceFile) || path.dirname(output) === output) throw new Error("公開用ファイルはpublicディレクトリや元データの上には保存できません。");
  try { await lstat(output); throw new Error("出力先が既に存在します。新しい出力先を指定してください。"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const source = await readFile(sourceFile), parsed = JSON.parse(source.toString("utf8"));
  if (!Array.isArray(parsed.articles)) throw new Error("記事ファイルの形式が不正です。");
  const file = normalizeArticleFile(parsed), eligible = publicArticleProjection(file.articles);
  // A published QA article cannot be distinguished by its title or body. Require
  // an explicit release selection rather than silently exporting every publication.
  if (eligible.length && options.articleIds === undefined) throw new Error("公開する記事IDを --article-id で明示してください。公開状態だけでは書き出しません。");
  const selected = new Set(options.articleIds ?? []);
  if (selected.size !== (options.articleIds?.length ?? 0) || [...selected].some(id => typeof id !== "string" || !id || !eligible.some(article => article.id === id))) throw new Error("書き出す記事IDが重複しているか、公開可能な記事ではありません。");
  const articles = eligible.filter(article => selected.has(article.id));
  const sources = [...new Set(articles.flatMap(articleImageSources))];
  if (sources.some(src => !safeArticleImageUrl(src))) throw new Error("公開記事に未対応の画像参照があります。");
  const ids = sources.filter(src => src.startsWith("/api/article-media/")).map(src => src.slice("/api/article-media/".length));
  if (ids.some(id => !MEDIA_ID.test(id))) throw new Error("画像IDが不正です。");
  await mkdir(path.dirname(output), { recursive: true });
  const parent = await realpath(path.dirname(output));
  if (inside(path.resolve("public"), parent)) throw new Error("public配下の出力先は使用できません。");
  const temporary = path.join(parent, path.basename(output) + ".tmp-" + randomUUID());
  if (path.dirname(temporary) !== parent) throw new Error("一時出力先が不正です。");
  await mkdir(temporary);
  const assets: Array<{ key: string; bytes: number; sha256: string }> = [];
  try {
    await mkdir(path.join(temporary, "data")); await mkdir(path.join(temporary, "media"));
    for (const id of ids) {
      const metadata = await readMediaManifest(options.storage, id);
      const objects = metadata ? [metadata.master, ...metadata.variants] : [{ key: id }];
      for (const asset of objects) {
        const bytes = await options.storage.get(asset.key), digest = hash(bytes);
        if ("sha256" in asset && (asset.sha256 !== digest || asset.bytes !== bytes.length)) throw new Error("画像の整合性を確認できませんでした。");
        await writeFile(path.join(temporary, "media", asset.key), bytes, { flag: "wx" });
        assets.push({ key: asset.key, bytes: bytes.length, sha256: digest });
      }
      if (metadata) {
        const safe = structuredClone(metadata); delete safe.source.key;
        await writeFile(path.join(temporary, "media", id.replace(/\.[^.]+$/u, ".meta.json")), JSON.stringify(safe, null, 2) + "\n", { flag: "wx" });
      }
    }
    await writeFile(path.join(temporary, "data", "articles.json"), JSON.stringify({ meta: { updatedAt: new Date().toISOString() }, articles }, null, 2) + "\n", { flag: "wx" });
    const report = { version: 1, createdAt: new Date().toISOString(), articleIds: articles.map(article => article.id), articleSlugs: articles.map(article => article.slug), mediaIds: ids, assets };
    await writeFile(path.join(temporary, "manifest.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
    if (hash(await readFile(sourceFile)) !== hash(source)) throw new Error("書き出し中に記事が更新されました。再実行してください。");
    // Same-parent atomic promotion; the source and any existing release are never overwritten.
    await rename(temporary, output);
    return { articleCount: articles.length, excludedArticleCount: file.articles.length - articles.length, imageCount: ids.length, assetCount: assets.length, outputDirectory: output };
  } catch (error) {
    if (path.dirname(temporary) === parent && path.basename(temporary).startsWith(path.basename(output) + ".tmp-")) await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}
