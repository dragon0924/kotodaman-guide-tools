import path from "node:path";
import { exportPublicContent } from "../lib/server/publicContent.ts";
import { articleMediaStorage } from "../lib/server/articleMedia.ts";

const args = process.argv.slice(2);
const option = (name: string) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const output = option("--output");
if (!output || output.startsWith("--")) throw new Error("--output <新しい書き出し先>を指定してください。");
const source = option("--source") ?? path.join(process.env.ARTICLE_DATA_DIRECTORY ?? "data", "articles.json");
const articleIds = args.flatMap((arg, index) => arg === "--article-id" ? [args[index + 1]] : []);
if (articleIds.some(id => !id || id.startsWith("--"))) throw new Error("--article-id <公開する記事ID>を指定してください。複数の記事はこの引数を繰り返します。");
console.log(JSON.stringify(await exportPublicContent({ sourceFile: source, outputDirectory: output, storage: articleMediaStorage(), ...(articleIds.length ? { articleIds } : {}) }), null, 2));
