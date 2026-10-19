import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {buildPublicSiteNavigation,emptySiteNavigation,validateSiteNavigation,type SiteNavigationSettings} from "../lib/siteNavigation.ts";
import {readSiteNavigation,writeSiteNavigation,NavigationConflictError} from "../lib/siteNavigationStore.ts";
import type {Article} from "../lib/types";

const now=new Date("2026-10-15T12:00+09:00");
const article=(id:string,publishedOn="2026-10-10"):Article=>({id,title:id,slug:id,type:"beginner_guide",status:"published",contentReviewed:true,publishedOn,sections:[],createdAt:"2026-10-01T00:00:00Z",updatedAt:"2026-10-15T00:00:00Z"});
const event=(id:string):Article=>({...article(id),type:"event_summary",event:{name:id,lastCheckedOn:"2026-10-15",publicationReviewed:true,officialUrls:["https://example.com/"],history:[],activities:[],period:{startAt:"2026-10-10T12:00+09:00",endAt:"2026-10-20T12:00+09:00",availability:"limited"}}});
const character=(id:string)=>({id,name:"同名",attribute:"火",species:"神",letters:["あ"]});
test("curated stable IDs preserve order and distinct forms rather than DB registration order",()=>{
  const settings={...emptySiteNavigation(),newCharacterIds:["b","a","deleted"]};
  const rows=[{...character("a"),adminMemo:"PRIVATE"},character("c"),character("b")],before=JSON.stringify(rows);
  const result=buildPublicSiteNavigation(settings,rows,[],now);
  assert.deepEqual(result.characters.map(c=>c.id),["b","a"]);assert.ok(!JSON.stringify(result).includes("PRIVATE"));assert.equal(JSON.stringify(rows),before);
});
test("draft, private, unreviewed event, unsafe slug and empty slug cannot leak titles, images or links",()=>{
  const drafts=[{...article("draft-secret"),status:"draft" as const},{...article("private-secret"),status:"archived" as const},{...event("event-secret"),event:{...event("x").event!,publicationReviewed:false}},{...article("review-secret"),contentReviewed:false},{...article("url-secret"),slug:"../secret"},{...article("empty-secret"),slug:""}];
  const data=buildPublicSiteNavigation({...emptySiteNavigation(),recommendedArticleIds:drafts.map(a=>a.id)},[],drafts,now);
  assert.deepEqual(data,{characters:[],events:[],recommended:[],recent:[]});assert.ok(!JSON.stringify(data).includes("secret"));
});
test("ongoing events reuse home periods and ended articles remain readable in recommendation archives",()=>{
  const active=event("active"),ended=event("ended");ended.event!.period!.endAt="2026-10-14T12:00+09:00";
  const settings={...emptySiteNavigation(),recommendedArticleIds:["ended","active"]};
  const data=buildPublicSiteNavigation(settings,[],[active,ended],now);
  assert.deepEqual(data.events.map(a=>a.id),["active"]);assert.deepEqual(data.recommended.map(a=>a.id),["ended"]);assert.deepEqual(data.recent,[]);
  assert.equal(buildPublicSiteNavigation(settings,[],[active],new Date("2026-10-20T12:00+09:00")).events.length,0);
});
test("a zero-result event or article section naturally produces no public cards",()=>{
  assert.deepEqual(buildPublicSiteNavigation(emptySiteNavigation(),[],[],now),{characters:[],events:[],recommended:[],recent:[]});
});
test("events, recommendations and recent articles are deduplicated, with curated recommendation order",()=>{
  const articles=[event("event"),article("old"),article("new","2026-10-15"),article("recommended-a"),article("recommended-b")];
  const data=buildPublicSiteNavigation({...emptySiteNavigation(),recommendedArticleIds:["recommended-b","recommended-a","event"]},[],articles,now);
  assert.deepEqual(data.recommended.map(a=>a.id),["recommended-b","recommended-a"]);assert.deepEqual(data.recent.map(a=>a.id),["new","old"]);
  const ids=[...data.events,...data.recommended,...data.recent].map(a=>a.id);assert.equal(new Set(ids).size,ids.length);
});
test("recent sorts by publication day, not last edit time; undated legacy articles follow dated ones",()=>{
  const old={...article("old","2026-10-10"),updatedAt:"2026-12-01T00:00Z"},latest=article("latest","2026-10-15"),undated=article("undated");delete undated.publishedOn;
  const data=buildPublicSiteNavigation(emptySiteNavigation(),[],[undated,old,latest],now);
  assert.deepEqual(data.recent.map(a=>a.id),["latest","old","undated"]);assert.equal(data.recent[2].publishedOn,undefined);
});
test("article thumbnails expose only approved stored image paths without copying article bodies",()=>{
  const a=article("visible");a.coverImage={src:"/images/banner.webp",alt:"画像",widthPercent:60,mobileWidthPercent:100};a.summary="NONPUBLIC-BODY";
  const data=buildPublicSiteNavigation(emptySiteNavigation(),[],[a],now);
  assert.equal(data.recent[0].imageSrc,"/images/banner.webp");assert.ok(!JSON.stringify(data).includes("NONPUBLIC-BODY"));
  a.coverImage.src="https://evil.test/track";assert.equal(buildPublicSiteNavigation(emptySiteNavigation(),[],[a],now).recent[0].imageSrc,undefined);
  a.event={...event("event").event!,bannerImageUrl:"/api/article-media/12345678-1234-1234-1234-123456789abc.webp"};
  assert.equal(buildPublicSiteNavigation(emptySiteNavigation(),[],[a],now).events[0].imageSrc,undefined);
  a.event.bannerImageUrl="/images/banner.webp";assert.equal(buildPublicSiteNavigation(emptySiteNavigation(),[],[a],now).events[0].imageSrc,"/images/banner.webp");
});
test("settings reject duplicate, unknown, over-limit IDs and extra attributes",()=>{
  const base=emptySiteNavigation();assert.doesNotThrow(()=>validateSiteNavigation(base));
  for(const value of [{...base,newCharacterIds:["a","a"]},{...base,newCharacterIds:Array.from({length:9},(_,i)=>String(i))},{...base,recommendedArticleIds:[1]},{...base,html:"script"},{...base,version:2}])assert.throws(()=>validateSiteNavigation(value));
  assert.throws(()=>validateSiteNavigation({...base,newCharacterIds:["unknown"]},{characterIds:new Set()}),/未登録/);
  assert.throws(()=>validateSiteNavigation({...base,recommendedArticleIds:["draft"]},{articleIds:new Set()}),/公開済み/);
});
test("safe settings saves restore order and reject stale or concurrent writes without touching article data",async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),"kotodaman-navigation-")),filePath=path.join(dir,"siteNavigation.json");
  try{
    const articles=Buffer.from('{"articles":[]}');await writeFile(path.join(dir,"articles.json"),articles);
    const before=await readSiteNavigation(filePath);assert.equal(before.revision,"missing");
    const options={filePath,expectedRevision:before.revision,characterIds:new Set(["a","b"]),articleIds:new Set(["public"])};
    const settings:SiteNavigationSettings={version:1,newCharacterIds:["b","a"],recommendedArticleIds:["public"]};
    const saved=await writeSiteNavigation(settings,options);assert.deepEqual(saved.settings.newCharacterIds,["b","a"]);
    await assert.rejects(writeSiteNavigation({...settings,newCharacterIds:["a"]},options),NavigationConflictError);
    const concurrent=await Promise.allSettled([writeSiteNavigation({...settings,newCharacterIds:["a","b"]},{...options,expectedRevision:saved.revision}),writeSiteNavigation({...settings,newCharacterIds:["b"]},{...options,expectedRevision:saved.revision})]);
    assert.equal(concurrent.filter(r=>r.status==="fulfilled").length,1);assert.equal(concurrent.filter(r=>r.status==="rejected").length,1);
    assert.deepEqual(await readFile(path.join(dir,"articles.json")),articles);
  }finally{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith("kotodaman-navigation-"));await rm(dir,{recursive:true,force:true});}
});
test("corrupt settings fail closed without being overwritten",async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),"kotodaman-navigation-")),filePath=path.join(dir,"siteNavigation.json");
  try{await writeFile(filePath,"{bad");await assert.rejects(readSiteNavigation(filePath));await assert.rejects(writeSiteNavigation(emptySiteNavigation(),{filePath,expectedRevision:"missing",characterIds:new Set(),articleIds:new Set()}));assert.equal(await readFile(filePath,"utf8"),"{bad");}
  finally{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith("kotodaman-navigation-"));await rm(dir,{recursive:true,force:true});}
});
