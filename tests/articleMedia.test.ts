import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { articleMediaStorage, prepareArticleImage, MAX_IMAGE_BYTES, type ArticleMediaStorage } from "../lib/server/articleMedia.ts";
import { saveArticleImage, readMediaManifest } from "../lib/server/articleImageOptimization.ts";
import { articleMediaResponse } from "../lib/server/articleMediaResponse.ts";
import { articleMediaWidth } from "../lib/articleMedia.ts";
import { validateArticleImage, safeArticleImageUrl } from "../lib/articleRichText.ts";
test("uploaded images are decoded, compressed to WebP and metadata is not carried over",async()=>{
  const input=await sharp({create:{width:3200,height:1200,channels:3,background:"#e5c578"}}).png().toBuffer();
  const result=await prepareArticleImage(input);assert.equal(result.width,3200);assert.equal(result.height,1200);
  const metadata=await sharp(result.bytes).metadata();assert.equal(metadata.format,"webp");assert.equal(metadata.exif,undefined);assert.ok(result.bytes.length<input.length);
  assert.ok(result.variants.every(v=>v.width<=1920&&v.height/v.width===1200/3200&&v.bytes.length<result.bytes.length));
});
test("dangerous formats, malformed files and oversized uploads fail before storage",async()=>{
  await assert.rejects(prepareArticleImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>')));
  await assert.rejects(prepareArticleImage(Buffer.from("<html>bad</html>")));
  await assert.rejects(prepareArticleImage(Buffer.alloc(MAX_IMAGE_BYTES+1)),/10MB/);
});
test("every advertised static format is accepted, including AVIF decoded as HEIF/AV1",async()=>{
  for(const format of ["jpeg","png","webp","avif"] as const){
    const input=await sharp({create:{width:20,height:10,channels:3,background:"#17304f"}}).toFormat(format).toBuffer();
    const prepared=await prepareArticleImage(input);
    const metadata=await sharp(prepared.bytes).metadata();assert.ok(["webp","png","jpeg"].includes(metadata.format!));assert.equal(metadata.width,20);assert.equal(metadata.height,10);
  }
});
test("local storage uses bounded UUID paths and completes without temporary leftovers",async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),"kotodaman-media-"));
  const before={backend:process.env.ARTICLE_MEDIA_BACKEND,directory:process.env.ARTICLE_MEDIA_DIRECTORY};
  process.env.ARTICLE_MEDIA_BACKEND="local";process.env.ARTICLE_MEDIA_DIRECTORY=directory;
  try {
    const storage=articleMediaStorage(),id=randomUUID()+".webp",bytes=await sharp({create:{width:10,height:10,channels:3,background:"red"}}).webp().toBuffer();
    await storage.put(id,bytes);assert.deepEqual(await storage.get(id),bytes);assert.deepEqual(await readdir(directory),[id]);
    await assert.rejects(storage.put(id,Buffer.from("replacement")));assert.deepEqual(await storage.get(id),bytes);
    await assert.rejects(storage.put("../escape.webp",bytes));await assert.rejects(storage.get("../escape.webp"));
  }finally{if(before.backend===undefined)delete process.env.ARTICLE_MEDIA_BACKEND;else process.env.ARTICLE_MEDIA_BACKEND=before.backend;if(before.directory===undefined)delete process.env.ARTICLE_MEDIA_DIRECTORY;else process.env.ARTICLE_MEDIA_DIRECTORY=before.directory;assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith("kotodaman-media-"));await rm(directory,{recursive:true,force:true});}
});
function memoryStorage() {
  const objects=new Map<string,Buffer>();
  const storage:ArticleMediaStorage={put:async(k,b)=>{if(objects.has(k))throw new Error("exists");objects.set(k,b);},get:async k=>{const b=objects.get(k);if(!b)throw Object.assign(new Error("missing"),{code:"ENOENT"});return b;},remove:async k=>{objects.delete(k);}};
  return {objects,storage};
}
const testImage=()=>sharp({create:{width:1200,height:800,channels:4,background:{r:30,g:80,b:150,alpha:0.5}}}).png().withExif({IFD0:{Artist:"not for publication"}}).toBuffer();
test("lossless screenshot master preserves every decoded pixel and alpha, removes metadata and supplies small derivatives",async()=>{
  const source=await testImage(),image=await prepareArticleImage(source,"screenshot");
  assert.deepEqual(await sharp(source).ensureAlpha().raw().toBuffer(),await sharp(image.bytes).ensureAlpha().raw().toBuffer());
  assert.equal((await sharp(image.bytes).metadata()).exif,undefined);
  assert.ok(image.variants.length>0);assert.ok(image.variants.every(v=>v.width<1200&&v.bytes.length<image.bytes.length));
});
test("JPEG/WebP no-op orientation retains decoded pixels without enlarging the sanitized master",async()=>{
  for(const format of ["jpeg","webp"] as const){const source=await sharp(await testImage()).flatten().toFormat(format).withExif({IFD0:{Artist:"private"}}).toBuffer();const output=await prepareArticleImage(source);assert.ok(output.bytes.length<=source.length);assert.equal((await sharp(output.bytes).metadata()).exif,undefined);assert.deepEqual(await sharp(source).raw().toBuffer(),await sharp(output.bytes).raw().toBuffer());}
});
test("EXIF rotation corrects geometry and raw source is retained privately for reprocessing",async()=>{
  const source=await sharp({create:{width:80,height:40,channels:3,background:"red"}}).jpeg().withMetadata({orientation:6}).toBuffer();
  const {storage,objects}=memoryStorage(),m=await saveArticleImage(storage,source);
  assert.equal(m.master.width,40);assert.equal(m.master.height,80);assert.deepEqual(objects.get(m.source.key!),source);assert.equal((await sharp(objects.get(m.id)!).metadata()).orientation,undefined);
  assert.deepEqual(await readMediaManifest(storage,m.id),m);
});
test("bundle failure rolls back only completed new objects and never returns a partial URL",async()=>{
  const {objects,storage}=memoryStorage();objects.set("unrelated",Buffer.from("keep"));let writes=0;
  const failing={...storage,put:async(k:string,b:Buffer)=>{if(++writes===3)throw new Error("disk full");await storage.put(k,b);}};
  await assert.rejects(saveArticleImage(failing,await testImage()),/disk full/);assert.deepEqual([...objects.keys()],["unrelated"]);
});
test("admin and public derivatives have the same reference gate; revocation also blocks conditional cache hits",async()=>{
  const {storage}=memoryStorage(),m=await saveArticleImage(storage,await testImage(),"screenshot");let published=false,reads=0;
  const options={admin:false,isPublic:async()=>published,storage:()=>{reads++;return storage;}};
  const req=(suffix="",etag?:string)=>new Request("https://example.test/api/article-media/"+m.id+suffix,{headers:etag?{"if-none-match":etag}:{}});
  assert.equal((await articleMediaResponse(req("?w=320"),m.id,options)).status,404);assert.equal(reads,0);
  const admin=await articleMediaResponse(req("?w=320"),m.id,{...options,admin:true});assert.equal(admin.status,200);assert.equal(admin.headers.get("cache-control"),"private, no-store");assert.equal(admin.headers.get("x-image-width"),"320");
  published=true;const response=await articleMediaResponse(req("?w=320"),m.id,options);assert.equal(response.status,200);assert.match(response.headers.get("cache-control")!,/must-revalidate/);const etag=response.headers.get("etag")!;
  assert.equal((await articleMediaResponse(req("?w=320",etag),m.id,options)).status,304);
  published=false;assert.equal((await articleMediaResponse(req("?w=320",etag),m.id,options)).status,404);
});
test("raw originals, manifests, derivative filenames and arbitrary transformations cannot be requested publicly",async()=>{
  const {storage}=memoryStorage(),m=await saveArticleImage(storage,await testImage());const options={admin:true,isPublic:async()=>true,storage:()=>storage};
  for(const id of [m.source.key!,m.variants[0].key,m.id.replace(/\.[^.]+$/u,".meta.json"),"../escape.webp"]){assert.equal((await articleMediaResponse(new Request("https://example.test/image"),id,options)).status,404);}
  for(const suffix of ["?w=10000","?w=0320","?w=320&w=640","?source=1","?url=https://other.test"]){assert.equal((await articleMediaResponse(new Request("https://example.test/image"+suffix),m.id,options)).status,400);}
});
test("legacy canonical images work without migration and corrupted manifests fail closed",async()=>{
  const {storage,objects}=memoryStorage(),id=randomUUID()+".webp",input=await sharp(await testImage()).webp().toBuffer();await storage.put(id,input);
  const options={admin:true,isPublic:async()=>false,storage:()=>storage},request=new Request("https://example.test/image?w=320");
  assert.deepEqual(Buffer.from(await(await articleMediaResponse(request,id,options)).arrayBuffer()),input);
  objects.set(id.replace(".webp",".meta.json"),Buffer.from("{}"));assert.equal((await articleMediaResponse(request,id,options)).status,404);
});
test("manifest path tampering and altered image bytes never leak arbitrary storage objects",async()=>{
  const {storage,objects}=memoryStorage(),m=await saveArticleImage(storage,await testImage()),key=m.id.replace(/\.[^.]+$/u,".meta.json");
  objects.set(key,Buffer.from(JSON.stringify({...m,master:{...m.master,key:m.source.key}})));await assert.rejects(readMediaManifest(storage,m.id));
  objects.set(key,Buffer.from(JSON.stringify(m)));objects.set(m.id,Buffer.from("corrupted"));assert.equal((await articleMediaResponse(new Request("https://example.test/image"),m.id,{admin:true,isPublic:async()=>false,storage:()=>storage})).status,404);
});
test("intrinsic dimensions survive article validation; unsafe sources and incomplete dimensions are rejected",()=>{
  const src="/api/article-media/"+randomUUID()+".png";assert.ok(safeArticleImageUrl(src));validateArticleImage({src,alt:"text",width:1800,height:3200,widthPercent:80,mobileWidthPercent:100});
  for(const image of [{src,alt:"x",width:1800},{src,alt:"x",width:0,height:40},{src:src+"?w=320",alt:"x"},{src,alt:"x",width:100000,height:100000}])assert.throws(()=>validateArticleImage(image));
  assert.equal(articleMediaWidth(350,3),960);assert.equal(articleMediaWidth(100,1),160);
});
test("production defaults to a read-only public bundle and still rejects ephemeral writable storage",async()=>{
  const env={node:process.env.NODE_ENV,backend:process.env.ARTICLE_MEDIA_BACKEND,persistent:process.env.ARTICLE_MEDIA_LOCAL_PERSISTENT};
  Object.assign(process.env,{NODE_ENV:"production"});delete process.env.ARTICLE_MEDIA_BACKEND;delete process.env.ARTICLE_MEDIA_LOCAL_PERSISTENT;
  try{const storage=articleMediaStorage();await assert.rejects(storage.put(randomUUID()+".webp",Buffer.from("x")),/読み取り専用/);await assert.rejects(storage.remove(randomUUID()+".webp"),/読み取り専用/);process.env.ARTICLE_MEDIA_BACKEND="local";assert.throws(()=>articleMediaStorage(),/永続/);}
  finally{for(const [key,value] of Object.entries({NODE_ENV:env.node,ARTICLE_MEDIA_BACKEND:env.backend,ARTICLE_MEDIA_LOCAL_PERSISTENT:env.persistent})){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
