import type { Article, ArticleBlock, ArticleImage, ArticleSection, RichTextDocument, RichTextNode } from "./types";
import { validDay } from "./articleEvents.ts";

export const VISUAL_BLOCK_TYPES = ["image", "characterCard", "collapse", "table"] as const;
const blockNodes = new Set(["paragraph", "heading", "bulletList", "orderedList", "blockquote", "horizontalRule", "codeBlock", "table"]);
const namedColors: Record<string, string> = { red:"#ff0000",blue:"#0000ff",green:"#008000",black:"#000000",white:"#ffffff",yellow:"#ffff00",orange:"#ffa500",purple:"#800080",gold:"#ffd700" };
export function safeTextColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const color = value.trim().toLowerCase();
  if (/^#(?:[a-f0-9]{3}|[a-f0-9]{4}|[a-f0-9]{6}|[a-f0-9]{8})$/u.test(color)) return color;
  if (namedColors[color]) return namedColors[color];
  const rgb = color.match(/^rgb\(\s*(\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\s*\)$/u);
  if (rgb && rgb.slice(1).every(n => Number(n) <= 255)) return "#" + rgb.slice(1).map(n=>Number(n).toString(16).padStart(2,"0")).join("");
  const rgba=color.match(/^rgba\(\s*(\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3}),\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*\)$/u);
  if(rgba&&rgba.slice(1,4).every(n=>Number(n)<=255))return "rgba("+rgba.slice(1,4).map(Number).join(",") + ","+Number(rgba[4])+")";
  return undefined;
}
export function safeTextSize(value:unknown):string|undefined {
  if(typeof value!=="string")return undefined;
  const match=value.match(/^(\d{1,2}(?:\.\d{1,2})?)(px|pt)$/u);if(!match)return undefined;
  const size=Number(match[1])*(match[2]==="pt"?4/3:1);
  return size>=8&&size<=96?Math.round(size*100)/100+"px":undefined;
}
export function safeRichUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value || /[\u0000-\u0020\\]/u.test(value)) return false;
  if (value.startsWith("/")) return !value.startsWith("//") && !/%(?:0[0-9a-f]|1[0-9a-f]|5c)/iu.test(value);
  if (/^#[a-zA-Z0-9_-]+$/u.test(value)) return true;
  try { const url = new URL(value); return ["https:","http:","mailto:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
export function safeArticleImageUrl(value: unknown): value is string {
  return typeof value === "string" && (/^\/api\/article-media\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(?:webp|png|jpg)$/u.test(value) || /^\/images\/[^?#\\]+$/u.test(value) && !value.split("/").some(p => p === "." || p === "..") && !value.includes("%"));
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
function requireValue(condition: unknown, message: string): asserts condition { if (!condition) throw new Error("リッチ本文: " + message); }
export function sanitizeRichDocument(value: unknown, characterIds?: Set<string>): RichTextDocument {
  let nodes = 0, textLength = 0;
  const walk = (input: unknown, depth: number): RichTextNode => {
    requireValue(depth <= 20 && ++nodes <= 10000, "本文が大きすぎます。");
    const raw = record(input), type = raw.type;
    requireValue(typeof type === "string" && (blockNodes.has(type) || ["doc","text","hardBreak","listItem","tableRow","tableCell","tableHeader"].includes(type)), "未対応の要素です。");
    requireValue(Object.keys(raw).every(key => ["type","text","attrs","marks","content"].includes(key)), "許可されていない属性です。");
    const node: RichTextNode = { type };
    const attrs = record(raw.attrs), clean: Record<string, unknown> = {};
    for (const [key,val] of Object.entries(attrs)) {
      if (val === null || val === undefined) continue;
      if (key === "level" && type === "heading") { requireValue([2,3,4].includes(Number(val)), "見出しはH2〜H4です。"); clean.level = Number(val); }
      else if (key === "textAlign" && ["paragraph","heading"].includes(type)) { requireValue(["left","center","right"].includes(String(val)), "配置が不正です。"); clean.textAlign = val; }
      else if (key === "start" && type === "orderedList") { requireValue(Number.isInteger(val) && Number(val)>0 && Number(val)<=10000, "リスト番号が不正です。"); clean.start = val; }
      else if (key === "language" && type === "codeBlock") { requireValue(typeof val==="string" && /^[a-z0-9_-]{0,30}$/iu.test(val), "コード属性が不正です。"); clean.language=val; }
      else if (["colspan","rowspan"].includes(key) && ["tableCell","tableHeader"].includes(type)) { requireValue(Number.isInteger(val) && Number(val)>=1 && Number(val)<=32, "セル結合数が不正です。"); clean[key]=val; }
      else if (key==="colwidth" && ["tableCell","tableHeader"].includes(type)) { requireValue(Array.isArray(val) && val.length<=32 && val.every(w=>Number.isInteger(w)&&w>=24&&w<=2000), "列幅が不正です。"); clean[key]=val; }
      else requireValue(false, "許可されていない要素属性です。");
    }
    if (type==="heading" && !clean.level) clean.level=2;
    if (Object.keys(clean).length) node.attrs=clean;
    if (type==="text") { requireValue(typeof raw.text==="string" && raw.text.length>0, "文字が不正です。"); textLength+=raw.text.length; requireValue(textLength<=1000000,"本文が長すぎます。"); node.text=raw.text; }
    else requireValue(raw.text===undefined,"文字はtext要素だけで使用します。");
    if (raw.marks!==undefined) {
      requireValue(["text","hardBreak"].includes(type) && Array.isArray(raw.marks) && raw.marks.length<=8,"装飾が不正です。");
      node.marks=raw.marks.map(inputMark=>{
        const mark=record(inputMark), name=mark.type, a=record(mark.attrs);
        requireValue(typeof name==="string" && ["bold","italic","underline","strike","code","link","textStyle","highlight"].includes(name),"許可されていない装飾です。");
        requireValue(Object.keys(mark).every(k=>["type","attrs"].includes(k)),"装飾属性が不正です。");
        const attributes: Record<string, unknown>={};
        for (const [key,val] of Object.entries(a)) {
          if (val===null || val===undefined) continue;
          if ((name==="textStyle"&&["color","backgroundColor"].includes(key)) || name==="highlight"&&key==="color") { const color=safeTextColor(val); requireValue(color,"色が不正です。"); attributes[key]=color; }
          else if (name==="textStyle"&&key==="fontSize") { const size=safeTextSize(val);requireValue(size,"文字サイズは8〜96pxです。"); attributes[key]=size; }
          else if (name==="link"&&key==="href") { requireValue(safeRichUrl(val),"リンクURLが不正です。"); attributes.href=val; }
          else if (name==="link"&&key==="characterId") { requireValue(typeof val==="string" && (!characterIds || characterIds.has(val)),"未登録のキャラIDです。"); attributes.characterId=val; }
          else if (name==="link"&&["target","rel"].includes(key)) { requireValue(typeof val==="string" && (key==="target"?["_blank","_self"].includes(val):/^[a-z -]{0,100}$/u.test(val)),"リンク属性が不正です。"); }
          else requireValue(false,"許可されていない装飾属性です。");
        }
        if (name==="link") {
          requireValue(safeRichUrl(attributes.href),"リンク先がありません。");
          if (attributes.characterId) requireValue(attributes.href==="/characters/"+encodeURIComponent(String(attributes.characterId)),"キャラIDとリンク先が一致しません。");
        }
        return {type:name,...(Object.keys(attributes).length?{attrs:attributes}:{})};
      });
    }
    if (raw.content!==undefined) { requireValue(Array.isArray(raw.content),"子要素が不正です。"); node.content=raw.content.map(child=>walk(child,depth+1)); }
    const children=node.content??[];
    const accepted=type==="doc"?blockNodes:type==="table"?new Set(["tableRow"]):type==="tableRow"?new Set(["tableCell","tableHeader"]):["bulletList","orderedList"].includes(type)?new Set(["listItem"]):["listItem","blockquote","tableCell","tableHeader"].includes(type)?blockNodes:["paragraph","heading","codeBlock"].includes(type)?new Set(["text","hardBreak"]):new Set<string>();
    requireValue(children.every(child=>accepted.has(child.type)),"要素の組み合わせが不正です。");
    if (["table","tableRow","bulletList","orderedList","listItem","blockquote","tableCell","tableHeader"].includes(type)) requireValue(children.length>0,"ブロックの子要素が空です。");
    if (type==="listItem") requireValue(children[0]?.type==="paragraph","リスト項目は段落から開始してください。");
    return node;
  };
  const doc=walk(value,0);
  requireValue(doc.type==="doc" && Array.isArray(doc.content),"文書形式が不正です。");
  return {type:"doc",content:doc.content};
}
export function legacyBlockDocument(block: ArticleBlock): RichTextDocument {
  if (block.richText) return sanitizeRichDocument(block.richText);
  const lines=block.content.split(/\r?\n/u);
  return {type:"doc",content:[{type:"paragraph",content:lines.flatMap((line,index)=>[...(index?[{type:"hardBreak"}]:[]),...(line?[{type:"text",text:line}]:[])])}]};
}
export function richTextPlain(node: RichTextNode): string {
  if (node.type==="text") return node.text??"";
  if (node.type==="hardBreak") return "\n";
  return (node.content??[]).map(richTextPlain).join(["doc","bulletList","orderedList","table","tableRow"].includes(node.type)?"\n":"");
}
export function validateArticleImage(value: ArticleImage) {
  requireValue(value && safeArticleImageUrl(value.src),"画像URLが不正です。");
  requireValue(typeof value.alt==="string" && value.alt.length<=2000,"代替テキストが不正です。");
  requireValue(value.caption===undefined || typeof value.caption==="string","キャプションが不正です。");
  requireValue(value.width===undefined&&value.height===undefined || Number.isInteger(value.width)&&value.width!>0&&Number.isInteger(value.height)&&value.height!>0&&value.width!*value.height!<=40000000,"画像の縦横サイズが不正です。");
  requireValue(value.widthPercent===undefined || Number.isFinite(value.widthPercent)&&value.widthPercent>=10&&value.widthPercent<=100,"画像幅は10〜100%です。");
  requireValue(value.mobileWidthPercent===undefined || Number.isFinite(value.mobileWidthPercent)&&value.mobileWidthPercent>=10&&value.mobileWidthPercent<=100,"スマホ画像幅は10〜100%です。");
  requireValue(value.align===undefined || ["left","center","right"].includes(value.align),"画像配置が不正です。");
  requireValue(!value.href || safeRichUrl(value.href),"画像リンクが不正です。");
  requireValue(Object.keys(value).every(k=>["src","alt","width","height","caption","widthPercent","mobileWidthPercent","align","href"].includes(k)),"画像に許可されていない属性があります。");
}
export function validateArticleRichContent(article: Article, ids?: Set<string>) {
  requireValue(article.publishedOn === undefined || typeof article.publishedOn === "string" && validDay(article.publishedOn), "公開日が不正です。");
  requireValue(article.contentReviewed===undefined || typeof article.contentReviewed==="boolean","公開前確認が不正です。");
  const campaignSections: ArticleSection[] = (article.event?.activities ?? []).filter(a => a.blocks !== undefined).map(a => {
    requireValue(Array.isArray(a.blocks), "施策本文はブロックの配列です。");
    return { id: "event-activity-" + encodeURIComponent(a.id), heading: a.name, blocks: a.blocks! };
  });
  const sections = [...article.sections, ...campaignSections];
  if (article.status==="published" && (article.coverImage || sections.some(s=>s.blocks.some(b=>b.richText||VISUAL_BLOCK_TYPES.includes(b.type as typeof VISUAL_BLOCK_TYPES[number]))))) requireValue(article.contentReviewed===true,"公開前プレビューを確認してください。");
  if (article.editHistory!==undefined) requireValue(Array.isArray(article.editHistory)&&article.editHistory.length<=5000&&article.editHistory.every(h=>h&&typeof h.at==="string"&&Number.isFinite(Date.parse(h.at))&&typeof h.note==="string"),"編集履歴が不正です。");
  if (article.coverImage) validateArticleImage(article.coverImage);
  if (article.quest?.bossImage) validateArticleImage(article.quest.bossImage);
  for (const m of article.quest?.mechanics ?? []) if (m.icon) validateArticleImage(m.icon);
  for (const d of article.quest?.drops ?? []) if (d.image) validateArticleImage(d.image);
  for (const board of article.quest?.boards ?? []) if (board.image) validateArticleImage(board.image);
  if (article.toc!==undefined) requireValue(typeof article.toc==="boolean","目次設定が不正です。");
  const used=new Set<string>();
  for (const section of sections) {
    requireValue(!Object.hasOwn(section, "eventActivity"), "編集用セクションを直接保存できません。");
    requireValue(section.hideHeading===undefined || typeof section.hideHeading==="boolean","見出し設定が不正です。");
    requireValue(!used.has(section.id),"セクションIDが重複しています。"); used.add(section.id);
    for (const block of section.blocks) {
      requireValue(block && typeof block.id === "string" && !!block.id && typeof block.content === "string" && ["paragraph", "point", "warning", "questInfoTable", "characterList", "deckExample", "boardPattern", "wordExamples", ...VISUAL_BLOCK_TYPES].includes(block.type), "ブロックの形式が不正です。");
      requireValue(!used.has(block.id),"ブロックIDが重複しています。"); used.add(block.id);
      if (block.richText) sanitizeRichDocument(block.richText,ids);
      if (block.image) validateArticleImage(block.image);
      if (block.type==="image") requireValue(block.image,"画像が未設定です。");
      if (block.characterIds) requireValue(Array.isArray(block.characterIds)&&block.characterIds.length<=12&&block.characterIds.every(id=>typeof id==="string"&&(!ids||ids.has(id))),"未登録のキャラIDです。");
      if (block.type==="characterCard") requireValue(block.characterIds?.length,"キャラが未設定です。");
      requireValue(block.spacing===undefined || Number.isFinite(block.spacing)&&block.spacing>=0&&block.spacing<=96,"余白は0〜96pxです。");
      requireValue(block.align===undefined || ["left","center","right"].includes(block.align),"ブロック配置が不正です。");
      requireValue(block.collapseTitle===undefined || typeof block.collapseTitle==="string","折りたたみ見出しが不正です。");
    }
  }
}
export function articleCharacterIds(article: Article): string[] {
  const ids=new Set(article.event?.activities.flatMap(a=>a.characterIds)??[]);
  article.quest?.recommendations.forEach(r=>{if(r.characterId)ids.add(r.characterId);});
  if (article.quest?.bossCharacterId) ids.add(article.quest.bossCharacterId);
  article.quest?.drops?.forEach(d=>{if(d.kind==="character"&&d.characterId)ids.add(d.characterId);});
  article.quest?.teams.forEach(t=>t.slots.forEach(id=>{if(id)ids.add(id);}));
  const walk=(node:RichTextNode)=>{ for(const mark of node.marks??[]) if(mark.type==="link"&&typeof mark.attrs?.characterId==="string")ids.add(mark.attrs.characterId); node.content?.forEach(walk); };
  const blocks = [...article.sections.flatMap(s=>s.blocks), ...(article.event?.activities.flatMap(a=>a.blocks??[])??[])];
  blocks.forEach(b=>{b.characterIds?.forEach(id=>ids.add(id));if(b.richText)walk(b.richText);});
  return [...ids];
}
export function articleImageSources(article: Article): string[] {
  return [article.coverImage?.src,...article.sections.flatMap(s=>s.blocks.map(b=>b.image?.src)),...(article.event?.activities.flatMap(a=>a.blocks?.map(b=>b.image?.src)??[])??[]),...(article.quest?.boards.map(b=>b.image?.src)??[]),article.quest?.bossImage?.src,...(article.quest?.mechanics.map(m=>m.icon?.src)??[]),...(article.quest?.drops?.map(d=>d.image?.src)??[])].filter((src):src is string=>!!src);
}
