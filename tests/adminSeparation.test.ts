import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { adminFeaturesEnabled, isAdminPath, publicContentDirectory } from "../lib/server/siteMode.ts";
import { isAdminRequest } from "../lib/server/adminAuth.ts";
import { publicCatalogHasArticle } from "../lib/server/publicCatalog.ts";
import { publicArticleProjection, exportPublicContent } from "../lib/server/publicContent.ts";
import { saveArticleImage } from "../lib/server/articleImageOptimization.ts";
import { articleMediaResponse } from "../lib/server/articleMediaResponse.ts";
import type { Article } from "../lib/types";
import type { ArticleMediaStorage } from "../lib/server/articleMedia.ts";

const article = (id: string): Article => ({ id, title: id, type: "beginner_guide", slug: id, status: "published", contentReviewed: true, createdAt: "2026-10-19T00:00:00Z", updatedAt: "2026-10-19T00:00:00Z", sections: [] });

test("production always disables management; public mode also disables a development server", () => {
  for (const SITE_MODE of [undefined,"local-admin","public","mistyped"]) assert.equal(adminFeaturesEnabled({NODE_ENV:"production",SITE_MODE}),false);
  assert.equal(adminFeaturesEnabled({NODE_ENV:"development"}),true);
  assert.equal(adminFeaturesEnabled({NODE_ENV:"development",SITE_MODE:"public"}),false);
  assert.equal(adminFeaturesEnabled({NODE_ENV:"development",SITE_MODE:"mistyped"}),false);
  assert.equal(publicContentDirectory({}),"content/public");
});

test("the entire admin tree is classified without matching public lookalike paths", () => {
  for (const name of ["/admin","/admin/","/admin/article-layout-preview","/api/admin","/api/admin/articles"]) assert.ok(isAdminPath(name));
  for (const name of ["/administrator","/api/administration","/articles/admin","/api/article-media/a"]) assert.equal(isAdminPath(name),false);
});

test("a valid password still cannot authorize public or production requests", () => {
  const previous={NODE_ENV:process.env.NODE_ENV,SITE_MODE:process.env.SITE_MODE,ADMIN_PASSWORD:process.env.ADMIN_PASSWORD};
  try {
    process.env.ADMIN_PASSWORD="unit-test-only";
    const good={headers:new Headers({"x-admin-password":"unit-test-only"})};
    Object.assign(process.env,{NODE_ENV:"development"});delete process.env.SITE_MODE;
    assert.ok(isAdminRequest(good));
    assert.equal(isAdminRequest({headers:new Headers()}),false);
    assert.equal(isAdminRequest({headers:new Headers({"x-admin-password":"wrong"})}),false);
    process.env.SITE_MODE="public";assert.equal(isAdminRequest(good),false);
    process.env.SITE_MODE="local-admin";Object.assign(process.env,{NODE_ENV:"production"});assert.equal(isAdminRequest(good),false);
  } finally {for(const[key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

test("public projection excludes draft, archived and unreviewed articles and unknown editor metadata", () => {
  const published={...article("ready"),editorScratch:"PRIVATE_EDITOR"};
  const before=JSON.stringify(published);
  const result=publicArticleProjection([published,{...article("draft-secret"),status:"draft"},{...article("archived-secret"),status:"archived"},{...article("unreviewed-secret"),contentReviewed:false}]);
  assert.deepEqual(result.map(a=>a.id),["ready"]);
  assert.ok(!JSON.stringify(result).includes("PRIVATE_EDITOR"));assert.ok(!JSON.stringify(result).includes("-secret"));
  assert.equal(JSON.stringify(published),before);
  assert.throws(()=>publicArticleProjection([article("ready"),article("ready")]),/重複/);
});

test("export copies only referenced published masters and variants, never retained originals or draft images", async () => {
  const root=await mkdtemp(path.join(os.tmpdir(),"public-export-"));
  const objects=new Map<string,Buffer>();
  const storage:ArticleMediaStorage={put:async(k,v)=>{objects.set(k,v);},get:async k=>{const v=objects.get(k);if(!v)throw Object.assign(new Error("Missing"),{code:"ENOENT"});return v;},remove:async k=>{objects.delete(k);}};
  try {
    const source=await sharp({create:{width:1200,height:800,channels:3,background:"#183451"}}).png().withExif({IFD0:{Artist:"PRIVATE_EXIF"}}).toBuffer();
    const master=await saveArticleImage(storage,source,"screenshot"),draft=await saveArticleImage(storage,source,"screenshot");
    const ready={...article("ready"),coverImage:{src:"/api/article-media/"+master.id,alt:"公開画像"}};
    const secret={...article("draft-secret"),status:"draft" as const,coverImage:{src:"/api/article-media/"+draft.id,alt:"秘密の画像"}};
    const file=path.join(root,"source.json");const bytes=JSON.stringify({articles:[ready,secret]});await writeFile(file,bytes);
    const output=path.join(root,"release");const result=await exportPublicContent({sourceFile:file,outputDirectory:output,storage,articleIds:["ready"]});
    assert.equal(result.articleCount,1);assert.equal(result.excludedArticleCount,1);
    assert.equal(await publicCatalogHasArticle("ready",output),true);
    assert.equal(await publicCatalogHasArticle("draft-secret",output),false);
    assert.equal(await readFile(file,"utf8"),bytes);
    const exported=await readFile(path.join(output,"data/articles.json"),"utf8");assert.ok(!exported.includes("draft-secret"));
    const images=await readdir(path.join(output,"media"));assert.ok(images.includes(master.id));assert.ok(master.variants.every(v=>images.includes(v.key)));
    assert.ok(!images.some(key=>key.includes(".source.")||key.startsWith(draft.id.split(".")[0])));
    const manifest=JSON.parse(await readFile(path.join(output,"media",master.id.replace(/\.[^.]+$/u,".meta.json")),"utf8"));assert.equal(manifest.source.key,undefined);
    await assert.rejects(exportPublicContent({sourceFile:file,outputDirectory:output,storage,articleIds:["ready"]}),/既に存在/);
    const reader:ArticleMediaStorage={get:async key=>readFile(path.join(output,"media",key)),put:async()=>{throw Error("read-only");},remove:async()=>{throw Error("read-only");}};
    for(const width of ["","?w=160","?w=640"]){
      const response=await articleMediaResponse(new Request("http://localhost/api/article-media/"+master.id+width),master.id,{admin:false,isPublic:async()=>true,storage:()=>reader});assert.equal(response.status,200);
      const denied=await articleMediaResponse(new Request("http://localhost/api/article-media/"+draft.id+width),draft.id,{admin:false,isPublic:async()=>false,storage:()=>reader});assert.equal(denied.status,404);
    }
  } finally {assert.ok(root.startsWith(os.tmpdir()));await rm(root,{recursive:true,force:true});}
});

test("the pre-render article catalog fails closed when absent, malformed or given an unsafe slug",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"public-catalog-"));
  try {
    assert.equal(await publicCatalogHasArticle("ready",root),false);
    await writeFile(path.join(root,"manifest.json"),'{"version":1,"articleSlugs":"ready"}');
    assert.equal(await publicCatalogHasArticle("ready",root),false);
    await writeFile(path.join(root,"manifest.json"),'{"version":1,"articleSlugs":["ready"]}');
    assert.ok(await publicCatalogHasArticle("ready",root));assert.equal(await publicCatalogHasArticle("../ready",root),false);
  } finally {assert.ok(root.startsWith(os.tmpdir()));await rm(root,{recursive:true,force:true});}
});

test("missing image export fails atomically, preserving the source and leaving no partial release", async () => {
  const root=await mkdtemp(path.join(os.tmpdir(),"public-export-failure-"));
  try {
    const source=path.join(root,"source.json"),output=path.join(root,"release");
    await writeFile(source,JSON.stringify({articles:[{...article("ready"),coverImage:{src:"/api/article-media/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.webp",alt:""}}]}));
    const storage:ArticleMediaStorage={get:async()=>{throw Object.assign(new Error("Missing"),{code:"ENOENT"});},put:async()=>{},remove:async()=>{}};
    await assert.rejects(exportPublicContent({sourceFile:source,outputDirectory:output,storage,articleIds:["ready"]}),/Missing/);
    assert.deepEqual(await readdir(root),["source.json"]);
  } finally {assert.ok(root.startsWith(os.tmpdir()));await rm(root,{recursive:true,force:true});}
});
