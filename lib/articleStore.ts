import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { writeJsonFilesSafely } from "./server/safeJsonFiles.ts";
import { assertEventArticle } from "./articleEvents.ts";
import { assertQuestArticle } from "./questArticle.ts";
import { adminFeaturesEnabled, publicContentDirectory } from "./server/siteMode.ts";
import { validateArticleRichContent, VISUAL_BLOCK_TYPES } from "./articleRichText.ts";
import type {
  Article,
  ArticleBlock,
  ArticleBlockType,
  ArticleFile,
  ArticleSection,
  ArticleStatus,
  ArticleTemplate,
  ArticleTemplateFile,
  ArticleTemplateSection,
  ArticleType,
} from "./types";

export const ARTICLES_PATH = path.join(adminFeaturesEnabled()
  ? process.env.ARTICLE_DATA_DIRECTORY ? path.resolve(process.env.ARTICLE_DATA_DIRECTORY) : path.join(process.cwd(), "data")
  : path.resolve(publicContentDirectory(), "data"), "articles.json");
export const ARTICLE_TEMPLATES_PATH = path.join(process.cwd(), "data", "articleTemplates.json");

export const ARTICLE_TYPES: ArticleType[] = [
  "quest_guide",
  "character_review",
  "deck_guide",
  "beginner_guide",
  "event_summary",
];

export const ARTICLE_STATUSES: ArticleStatus[] = ["draft", "published", "archived"];
export const MVP_ARTICLE_BLOCK_TYPES: ArticleBlockType[] = ["paragraph", "point", "warning"];
export const FUTURE_ARTICLE_BLOCK_TYPES: ArticleBlockType[] = [
  "questInfoTable",
  "characterList",
  "deckExample",
  "boardPattern",
  "wordExamples",
];
const EVENT_ARTICLE_TEMPLATE: ArticleTemplate = {
  id:"event_summary_default",type:"event_summary",label:"イベントまとめ",
  sections:["イベント概要","ガチャ・新キャラ","報酬・交換所","降臨・攻略情報"].map((heading,index)=>({
    id:"event_section_"+index,heading,defaultBlocks:[{type:"paragraph",content:""}],allowedBlockTypes:["paragraph","point","warning"],
  })),
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeArticleType(value: unknown): ArticleType {
  return ARTICLE_TYPES.includes(value as ArticleType) ? value as ArticleType : "quest_guide";
}

function normalizeArticleStatus(value: unknown): ArticleStatus {
  return ARTICLE_STATUSES.includes(value as ArticleStatus) ? value as ArticleStatus : "draft";
}

function normalizeBlockType(value: unknown): ArticleBlockType {
  return [...MVP_ARTICLE_BLOCK_TYPES, ...FUTURE_ARTICLE_BLOCK_TYPES, ...VISUAL_BLOCK_TYPES].includes(value as ArticleBlockType) ? value as ArticleBlockType : "paragraph";
}

function normalizeAllowedBlockType(value: unknown): ArticleBlockType | null {
  const type = value as ArticleBlockType;
  return [...MVP_ARTICLE_BLOCK_TYPES, ...FUTURE_ARTICLE_BLOCK_TYPES].includes(type) ? type : null;
}

function fallbackId(prefix: string, index: number) {
  return `${prefix}-${index + 1}`;
}

export function normalizeArticleBlock(value: unknown, index = 0): ArticleBlock {
  const raw = asRecord(value);
  return {
    ...raw,
    id: stringValue(raw.id, fallbackId("block", index)),
    type: normalizeBlockType(raw.type),
    content: String(raw.content ?? ""),
  };
}

export function normalizeArticleSection(value: unknown, index = 0): ArticleSection {
  const raw = asRecord(value);
  const blocks = Array.isArray(raw.blocks)
    ? raw.blocks.map((block, blockIndex) => normalizeArticleBlock(block, blockIndex))
    : [];
  return {
    ...raw,
    id: stringValue(raw.id, fallbackId("section", index)),
    heading: stringValue(raw.heading, "見出し"),
    blocks: Array.isArray(raw.blocks) ? blocks : [normalizeArticleBlock({ type: "paragraph", content: "" })],
  };
}

export function normalizeArticle(value: unknown, index = 0): Article | null {
  const raw = asRecord(value);
  const id = stringValue(raw.id, fallbackId("article", index));
  const title = stringValue(raw.title, "無題の記事");
  if (!id || !title) {
    return null;
  }
  const now = new Date().toISOString();
  const sections = Array.isArray(raw.sections)
    ? raw.sections.map((section, sectionIndex) => normalizeArticleSection(section, sectionIndex))
    : [];
  return {
    ...raw,
    id,
    title,
    type: normalizeArticleType(raw.type),
    status: normalizeArticleStatus(raw.status),
    slug: String(raw.slug ?? ""),
    summary: String(raw.summary ?? ""),
    sections,
    createdAt: stringValue(raw.createdAt, now),
    updatedAt: stringValue(raw.updatedAt, now),
  };
}

export function normalizeArticleFile(value: unknown): ArticleFile {
  const raw = asRecord(value);
  return {
    ...raw,
    meta: asRecord(raw.meta),
    articles: Array.isArray(raw.articles)
      ? raw.articles.map((article, index) => normalizeArticle(article, index)).filter((article): article is Article => Boolean(article))
      : [],
  };
}

function normalizeTemplateBlock(value: unknown): { type: ArticleBlockType; content: string } {
  const raw = asRecord(value);
  return {
    type: normalizeBlockType(raw.type),
    content: String(raw.content ?? ""),
  };
}

function normalizeTemplateSection(value: unknown, index = 0): ArticleTemplateSection {
  const raw = asRecord(value);
  const defaultBlocks = Array.isArray(raw.defaultBlocks)
    ? raw.defaultBlocks.map((block) => normalizeTemplateBlock(block))
    : [];
  const allowedBlockTypes = Array.isArray(raw.allowedBlockTypes)
    ? raw.allowedBlockTypes.map(normalizeAllowedBlockType).filter((type): type is ArticleBlockType => Boolean(type))
    : [];
  return {
    id: stringValue(raw.id, fallbackId("section", index)),
    heading: stringValue(raw.heading, "見出し"),
    defaultBlocks: defaultBlocks.length ? defaultBlocks : [{ type: "paragraph", content: "" }],
    allowedBlockTypes: allowedBlockTypes.length ? allowedBlockTypes : [...MVP_ARTICLE_BLOCK_TYPES],
  };
}

export function normalizeArticleTemplate(value: unknown, index = 0): ArticleTemplate | null {
  const raw = asRecord(value);
  const id = stringValue(raw.id, fallbackId("article_template", index));
  const type = normalizeArticleType(raw.type);
  const sections = Array.isArray(raw.sections)
    ? raw.sections.map((section, sectionIndex) => normalizeTemplateSection(section, sectionIndex))
    : [];
  return {
    id,
    type,
    label: stringValue(raw.label, type),
    sections,
  };
}

export function normalizeArticleTemplateFile(value: unknown): ArticleTemplateFile {
  const raw = asRecord(value);
  return {
    meta: asRecord(raw.meta),
    templates: Array.isArray(raw.templates)
      ? raw.templates
        .map((template, index) => normalizeArticleTemplate(template, index))
        .filter((template): template is ArticleTemplate => Boolean(template))
      : [],
  };
}

export class ArticleConflictError extends Error {}
const revisionOf = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
export async function readArticleSnapshot(filePath = ARTICLES_PATH): Promise<{ file: ArticleFile; revision: string }> {
  try {
    const bytes = await readFile(filePath);
    const parsed = JSON.parse(bytes.toString("utf8")) as ArticleFile;
    if (!Array.isArray(parsed.articles)) throw new Error("articlesは配列である必要があります。");
    return { file: normalizeArticleFile(parsed), revision: revisionOf(bytes) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return {
      file: { meta: { updatedAt: null }, articles: [] },
      revision: "missing",
    };
  }
}
export async function readArticles(): Promise<ArticleFile> { return (await readArticleSnapshot()).file; }

export async function readArticleTemplates(): Promise<ArticleTemplateFile> {
  try {
    const payload = await readFile(ARTICLE_TEMPLATES_PATH, "utf8");
    const file = normalizeArticleTemplateFile(JSON.parse(payload));
    return {...file,templates:file.templates.some(t=>t.type==="event_summary")?file.templates:[...file.templates,EVENT_ARTICLE_TEMPLATE]};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return {
      meta: { updatedAt: null },
      templates: [],
    };
  }
}

export function validateArticleFile(file: ArticleFile, characterIds?: Set<string>) {
  if (!file || !Array.isArray(file.articles)) throw new Error("articlesは配列である必要があります。");
  const ids = new Set<string>(), slugs = new Set<string>();
  for (const article of file.articles) {
    if (!article.id || ids.has(article.id)) throw new Error("記事IDが空、または重複しています。");
    ids.add(article.id);
    if (article.slug) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(article.slug) || slugs.has(article.slug)) throw new Error("URL名は半角英数字とハイフンで、重複しないようにしてください。");
      slugs.add(article.slug);
    }
    if (article.status === "published" && !article.slug) throw new Error("公開記事にはURL名が必要です。");
    if (article.status === "published" && article.contentReviewed === false) throw new Error("公開前プレビューを確認してから公開してください。");
    assertQuestArticle(article, characterIds);
    assertEventArticle(article, characterIds);
    validateArticleRichContent(article, characterIds);
  }
}
let articleWriteQueue: Promise<unknown> = Promise.resolve();
export function writeArticles(file: ArticleFile, options: { filePath?: string; expectedRevision?: string; characterIds?: Set<string> } = {}): Promise<ArticleFile> {
  const write = async () => {
  const filePath = options.filePath ?? ARTICLES_PATH;
  validateArticleFile(file, options.characterIds);
  const snapshot = await readArticleSnapshot(filePath);
  if (options.expectedRevision !== undefined && options.expectedRevision !== snapshot.revision) throw new ArticleConflictError("記事が別の操作で更新されています。再読み込みしてから保存してください。");
  const now = new Date().toISOString();
  const normalized = normalizeArticleFile({
    ...snapshot.file,
    ...file,
    meta: {
      ...(snapshot.file.meta ?? {}),
      ...(file.meta ?? {}),
      updatedAt: now,
    },
    articles: (file.articles ?? []).map((article) => ({
      ...article,
      updatedAt: article.updatedAt || now,
      ...(JSON.stringify(article) !== JSON.stringify(snapshot.file.articles.find(old=>old.id===article.id)) ? {
        editHistory: [...(snapshot.file.articles.find(old=>old.id===article.id)?.editHistory ?? []), {at:now,note:snapshot.file.articles.some(old=>old.id===article.id)?"記事を更新":"下書きを作成"}],
      } : {}),
    })),
  });
  validateArticleFile(normalized, options.characterIds);
  await writeJsonFilesSafely([{path:filePath,value:normalized,validate:value=>validateArticleFile(value as ArticleFile,options.characterIds)}], {
    beforeReplace: async () => { if ((await readArticleSnapshot(filePath)).revision !== snapshot.revision) throw new ArticleConflictError("記事が保存中に更新されました。再読み込みしてください。"); },
  });
  return normalized;
  };
  const pending = articleWriteQueue.then(write, write);
  articleWriteQueue = pending.catch(() => undefined);
  return pending;
}
