import { readFile } from "node:fs/promises";
import path from "node:path";
import { publicContentDirectory } from "./siteMode.ts";

/** The request gate reads a published-only catalog, never the local editing database. */
export async function publicCatalogHasArticle(slug: string, directory = publicContentDirectory()) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) return false;
  try {
    const file = JSON.parse(await readFile(path.resolve(directory, "manifest.json"), "utf8"));
    return file.version === 1 && Array.isArray(file.articleSlugs)
      && file.articleSlugs.every((value: unknown) => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value))
      && file.articleSlugs.includes(slug);
  } catch { return false; }
}
