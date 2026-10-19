import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sanitizeRichDocument, richTextPlain, validateArticleRichContent, safeRichUrl, safeArticleImageUrl, articleCharacterIds } from "../lib/articleRichText.ts";
import { normalizeArticleFile, readArticleSnapshot, writeArticles, ArticleConflictError } from "../lib/articleStore.ts";
import { isPublicArticle } from "../lib/articleEvents.ts";
import type { Article, RichTextDocument } from "../lib/types";
const article=():Article=>({id:"test-article",title:"記事",type:"quest_guide",status:"draft",sections:[{id:"s",heading:"見出し",blocks:[{id:"b",type:"paragraph",content:"本文"}]}],createdAt:"2026-10-13T00:00:00Z",updatedAt:"2026-10-13T00:00:00Z"});
const doc=(text="赤色のうつつ"):RichTextDocument=>({type:"doc",content:[{type:"paragraph",content:[{type:"text",text,marks:[{type:"bold"},{type:"textStyle",attrs:{color:"#ff0000",backgroundColor:"#fff2a8",fontSize:"24px"}},{type:"link",attrs:{href:"/characters/real",characterId:"real"}}]}]}]});
test("partial text styling, backgrounds, sizes, links and characters survive structured roundtrips",()=>{
  const value=doc(),clean=sanitizeRichDocument(value,new Set(["real"]));
  assert.deepEqual(clean,value);assert.equal(richTextPlain(clean),"赤色のうつつ");
  assert.deepEqual(sanitizeRichDocument(JSON.parse(JSON.stringify(clean))),clean);
  const a=article();a.sections[0].blocks[0].richText=clean;assert.deepEqual(articleCharacterIds(a),["real"]);assert.throws(()=>validateArticleRichContent(a,new Set(["other"])),/未登録/);
});
test("server rejects scripts, HTML, event attributes, CSS expressions and unsafe links",()=>{
  const cases=[{type:"script",text:"alert(1)"},{type:"paragraph",attrs:{onclick:"alert(1)"}},{type:"paragraph",content:[{type:"text",text:"x",marks:[{type:"textStyle",attrs:{color:"url(javascript:x)"}}]}]},{type:"paragraph",content:[{type:"text",text:"x",marks:[{type:"link",attrs:{href:"javascript:alert(1)"}}]}]}];
  for(const node of cases)assert.throws(()=>sanitizeRichDocument({type:"doc",content:[node]}));
  for(const url of ["javascript:x","JaVaScRiPt:x","data:text/html,x","//evil.test","https://u:p@evil.test","/a\\b","\nhttps://a.test"])assert.equal(safeRichUrl(url),false,url);
  for(const url of ["https://example.com/path","/characters/real","mailto:hello@example.com","#heading"])assert.equal(safeRichUrl(url),true,url);
});
test("headings, lists, quotes and tables have bounded allowed attributes and structural nesting",()=>{
  const value={type:"doc",content:[{type:"heading",attrs:{level:3,textAlign:"center"},content:[{type:"text",text:"見出し"}]},{type:"bulletList",content:[{type:"listItem",content:[{type:"paragraph",content:[]}]}]},{type:"table",content:[{type:"tableRow",content:[{type:"tableHeader",attrs:{colspan:1,rowspan:1,colwidth:[120]},content:[{type:"paragraph",content:[]}]}]}]}]};
  assert.deepEqual(sanitizeRichDocument(value),value);
  assert.throws(()=>sanitizeRichDocument({type:"doc",content:[{type:"heading",attrs:{level:1}}]}));
  assert.throws(()=>sanitizeRichDocument({type:"doc",content:[{type:"table",content:[{type:"text",text:"bad"}]}]}));
});
test("image URLs, widths and captions are validated without permitting HTML or arbitrary file paths",()=>{
  const a=article();a.coverImage={src:"/api/article-media/12345678-1234-1234-1234-123456789abc.webp",alt:"説明",caption:"キャプション",widthPercent:60,align:"right"};
  assert.doesNotThrow(()=>validateArticleRichContent(a));
  for(const source of ["javascript:x","/images/../secret","/images/%2e%2e/secret","file:///C:/secret","https://evil.test/a.svg"])assert.equal(safeArticleImageUrl(source),false);
  a.coverImage.widthPercent=101;assert.throws(()=>validateArticleRichContent(a));
});
test("PC and mobile image widths survive saves independently without changing legacy widths",async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),"kotodaman-image-width-")),filePath=path.join(directory,"articles.json");
  try {
    const legacy=article();legacy.id="legacy";legacy.coverImage={src:"/images/sample.png",alt:"以前の画像",widthPercent:73};
    const edited=article();edited.coverImage={src:"/images/sample.png",alt:"表紙",widthPercent:60,mobileWidthPercent:100};
    edited.sections[0].blocks.push({id:"image",type:"image",content:"",image:{src:"/images/sample.png",alt:"本文",widthPercent:45,mobileWidthPercent:85}});
    await writeFile(filePath,JSON.stringify({articles:[legacy,edited]}));
    const before=await readArticleSnapshot(filePath);
    await writeArticles(before.file,{filePath,expectedRevision:before.revision});
    const saved=(await readArticleSnapshot(filePath)).file.articles;
    assert.deepEqual(saved[0].coverImage,legacy.coverImage);
    assert.deepEqual(saved[1].coverImage,edited.coverImage);
    assert.deepEqual(saved[1].sections[0].blocks[1].image,edited.sections[0].blocks[1].image);
    for(const invalid of [0,9,101,NaN,Infinity,"70"]){edited.coverImage.mobileWidthPercent=invalid as number;assert.throws(()=>validateArticleRichContent(edited),/スマホ画像幅/);}
    delete edited.coverImage.mobileWidthPercent;assert.doesNotThrow(()=>validateArticleRichContent(edited));
  }finally{assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith("kotodaman-image-width-"));await rm(directory,{recursive:true,force:true});}
});
test("visual blocks remain compatible with normalization and duplicate IDs cannot silently discard content",()=>{
  const a=article();a.sections[0].blocks.push({id:"new",type:"table",content:"table",richText:{type:"doc",content:[{type:"paragraph",content:[]}]}});
  assert.deepEqual(normalizeArticleFile({articles:[a]}).articles[0].sections,a.sections);
  a.sections[0].blocks[1].id="b";assert.throws(()=>validateArticleRichContent(a),/重複/);
});
test("unreviewed visual publication is blocked while untouched legacy publications remain compatible",async()=>{
  const a=article();a.status="published";a.slug="public";assert.ok(isPublicArticle(a));
  a.contentReviewed=false;assert.equal(isPublicArticle(a),false);
  a.contentReviewed=true;assert.ok(isPublicArticle(a));
  a.sections[0].blocks[0].richText=doc();a.contentReviewed=undefined;assert.throws(()=>validateArticleRichContent(a),/公開前/);
  a.contentReviewed=true;assert.doesNotThrow(()=>validateArticleRichContent(a));
});
test("pasted point sizes and alpha colors are safely normalized without dropping text or styled line breaks",()=>{
  const value={type:"doc",content:[{type:"paragraph",content:[{type:"text",text:"保持",marks:[{type:"textStyle",attrs:{fontSize:"12pt",color:"rgba(255, 0, 0, 0.5)"}}]},{type:"hardBreak",marks:[{type:"bold"}]},{type:"text",text:"次の行"}]}]};
  const clean=sanitizeRichDocument(value);assert.equal(clean.content[0].content?.[0].marks?.[0].attrs?.fontSize,"16px");assert.equal(richTextPlain(clean),"保持\n次の行");assert.equal(clean.content[0].content?.[0].marks?.[0].attrs?.color,"rgba(255,0,0,0.5)");
});
test("saving visual edits preserves untouched articles, event periods and history, and detects concurrent saves",async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),"kotodaman-rich-")),filePath=path.join(directory,"articles.json");
  try {
    const existing=JSON.parse(await readFile("data/articles.json","utf8")).articles as Article[];
    await writeFile(filePath,JSON.stringify({articles:[...existing,article()]}));
    const snapshot=await readArticleSnapshot(filePath),edited=article();edited.sections[0].blocks[0].richText=doc();
    await writeArticles({articles:[...existing,edited]},{filePath,expectedRevision:snapshot.revision,characterIds:undefined});
    const next=await readArticleSnapshot(filePath);assert.deepEqual(next.file.articles.slice(0,-1),existing);assert.deepEqual(next.file.articles.at(-1)?.sections,edited.sections);assert.equal(next.file.articles.at(-1)?.editHistory?.length,1);
    await assert.rejects(writeArticles({articles:[...existing,article()]},{filePath,expectedRevision:snapshot.revision}),ArticleConflictError);
    assert.deepEqual((await readArticleSnapshot(filePath)).file,next.file);
  }finally{assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith("kotodaman-rich-"));await rm(directory,{recursive:true,force:true});}
});
