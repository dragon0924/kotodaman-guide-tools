import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { exportPublicContent } from "../lib/server/publicContent.ts";
import { saveArticleImage } from "../lib/server/articleImageOptimization.ts";
import { articleMediaResponse } from "../lib/server/articleMediaResponse.ts";
import { articleImageSources } from "../lib/articleRichText.ts";
import { isPublicArticle } from "../lib/articleEvents.ts";
import type { Article } from "../lib/types";
import type { ArticleMediaStorage } from "../lib/server/articleMedia.ts";

const article = (id: string): Article => ({ id, title: id, slug: id, type: "beginner_guide", status: "published", contentReviewed: true, sections: [], createdAt: "2026-10-19T00:00:00Z", updatedAt: "2026-10-19T00:00:00Z" });
const memoryStorage = () => {
  const objects = new Map<string, Buffer>();
  const storage: ArticleMediaStorage = {
    get: async key => { const bytes = objects.get(key); if (!bytes) throw Object.assign(new Error("Missing"), { code: "ENOENT" }); return bytes; },
    put: async (key, bytes) => { objects.set(key, bytes); }, remove: async key => { objects.delete(key); },
  };
  return { objects, storage };
};

test("a release requires explicit IDs and omits an unselected published QA article without guessing its name", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "public-selection-"));
  try {
    const { storage } = memoryStorage(), source = path.join(root, "articles.json");
    const articles: Article[] = [article("ready"), article("otherwise-normal-qa"), { ...article("draft"), status: "draft" }, { ...article("private"), status: "archived" }, { ...article("unreviewed"), contentReviewed: false }];
    const bytes = JSON.stringify({ meta: { internalToken: "PRIVATE_SETTING" }, articles });
    await writeFile(source, bytes);
    const output = path.join(root, "release");
    await assert.rejects(exportPublicContent({ sourceFile: source, outputDirectory: output, storage }), /記事ID/);
    for (const articleIds of [["ready", "ready"], ["draft"], ["private"], ["unreviewed"], ["missing"]]) {
      await assert.rejects(exportPublicContent({ sourceFile: source, outputDirectory: output, storage, articleIds }), /公開可能/);
    }
    assert.deepEqual(await readdir(root), ["articles.json"]);
    const result = await exportPublicContent({ sourceFile: source, outputDirectory: output, storage, articleIds: ["ready"] });
    assert.equal(result.articleCount, 1); assert.equal(result.excludedArticleCount, 4);
    const released = await readFile(path.join(output, "data/articles.json"), "utf8");
    for (const forbidden of ["otherwise-normal-qa", "PRIVATE_SETTING", '"id": "draft"', '"id": "private"', '"id": "unreviewed"']) assert.ok(!released.includes(forbidden));
    assert.equal(await readFile(source, "utf8"), bytes);
  } finally { assert.ok(root.startsWith(os.tmpdir())); await rm(root, { recursive: true, force: true }); }
});

test("successive full releases preserve old and optimized image URLs, bytes and ETags; revocation rejects cached requests", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "public-releases-"));
  try {
    const { storage, objects } = memoryStorage();
    const png = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#183451" } }).png().toBuffer();
    const optimized = await saveArticleImage(storage, png, "screenshot"), unused = await saveArticleImage(storage, png, "screenshot");
    const legacyId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png"; objects.set(legacyId, png);
    const first: Article = { ...article("first"), coverImage: { src: "/api/article-media/" + optimized.id, alt: "配信用画像", width: 1200, height: 800 }, sections: [{ id: "body", heading: "本文", blocks: [{ id: "legacy", type: "image", content: "", image: { src: "/api/article-media/" + legacyId, alt: "従来形式画像" } }] }] };
    const second = article("second"), qa = { ...article("published-qa"), coverImage: { src: "/api/article-media/" + unused.id, alt: "検証専用画像" } };
    const source = path.join(root, "articles.json"), expected = new Map<string, { bytes: string; etag: string | null }>();
    const sourceObjects = new Map([...objects].map(([key, value]) => [key, Buffer.from(value)]));
    for (let release = 0; release < 3; release++) {
      await writeFile(source, JSON.stringify({ articles: release ? [first, second, qa] : [first, qa] }));
      const directory = path.join(root, "release-" + release);
      await exportPublicContent({ sourceFile: source, outputDirectory: directory, storage, articleIds: release ? ["first", "second"] : ["first"] });
      const file = JSON.parse(await readFile(path.join(directory, "data/articles.json"), "utf8")) as { articles: Article[] };
      assert.deepEqual(articleImageSources(file.articles[0]), articleImageSources(first));
      const keys = await readdir(path.join(directory, "media"));
      assert.ok(!keys.some(key => key.includes(".source.") || key.startsWith(unused.id.split(".")[0])));
      const reader: ArticleMediaStorage = { get: key => readFile(path.join(directory, "media", key)), put: async () => { throw Error("Read only"); }, remove: async () => { throw Error("Read only"); } };
      for (const id of [optimized.id, legacyId]) for (const width of ["", "?w=160", "?w=640"]) {
        const url = "/api/article-media/" + id + width;
        const response = await articleMediaResponse(new Request("http://localhost" + url), id, { admin: false, storage: () => reader, isPublic: async () => file.articles.some(a => isPublicArticle(a) && articleImageSources(a).includes("/api/article-media/" + id)) });
        assert.equal(response.status, 200);
        const bytes = Buffer.from(await response.arrayBuffer()).toString("base64"), etag = response.headers.get("etag");
        if (expected.has(url)) assert.deepEqual({ bytes, etag }, expected.get(url)); else expected.set(url, { bytes, etag });
      }
    }
    // A failed replacement cannot damage any previous, complete release.
    const old = await readFile(path.join(root, "release-2", "manifest.json"));
    const missing = { ...first, coverImage: { src: "/api/article-media/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.png", alt: "不足画像" } };
    await writeFile(source, JSON.stringify({ articles: [missing] }));
    await assert.rejects(exportPublicContent({ sourceFile: source, outputDirectory: path.join(root, "failed"), storage, articleIds: ["first"] }), /Missing/);
    assert.deepEqual(await readFile(path.join(root, "release-2", "manifest.json")), old);
    assert.ok(!(await readdir(root)).some(name => name.startsWith("failed")));
    const revoked = await articleMediaResponse(new Request("http://localhost/api/article-media/" + optimized.id, { headers: { "if-none-match": expected.get("/api/article-media/" + optimized.id)!.etag! } }), optimized.id, { admin: false, storage: () => storage, isPublic: async () => false });
    assert.equal(revoked.status, 404);
    assert.deepEqual(objects, sourceObjects);
  } finally { assert.ok(root.startsWith(os.tmpdir())); await rm(root, { recursive: true, force: true }); }
});
