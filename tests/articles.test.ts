import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { articleEventStatus, assertEventArticle, eventPeriodStatus, eventPeriodText, instantToJstInput, isPublicArticle, isSafeArticleUrl, jstInputToInstant, validEventInstant } from "../lib/articleEvents.ts";
import { ArticleConflictError, normalizeArticleFile, readArticleSnapshot, validateArticleFile, writeArticles } from "../lib/articleStore.ts";
import type { Article, ArticleEvent } from "../lib/types";
const event=():ArticleEvent=>({name:"イベント",activities:[{id:"gacha",name:"ガチャ",kind:"gacha",period:{startAt:"2026-10-10T12:00+09:00",endAt:"2026-10-20T03:59+09:00"},summary:"公式概要",characterIds:["real"],officialUrl:"https://kotodaman.jp/info/example.html"}],officialUrls:["https://kotodaman.jp/info/example.html"],lastCheckedOn:"2026-10-13",publicationReviewed:false,history:[{checkedOn:"2026-10-13",note:"下書き作成"}]});
const article=():Article=>({id:"draft",title:"下書き",type:"event_summary",status:"draft",slug:"event-draft",summary:"概要",sections:[{id:"s",heading:"概要",blocks:[{id:"b",type:"paragraph",content:"本文"}]}],createdAt:"2026-10-13T00:00:00Z",updatedAt:"2026-10-13T00:00:00Z",event:event()});

test("JST event boundaries distinguish upcoming, active and ended without host timezone dependence",()=>{
 const period=event().activities[0].period;
 const before=structuredClone(period);
 for(const [instant,expected] of [["2026-10-10T02:59:59.999Z","upcoming"],["2026-10-10T03:00:00.000Z","ongoing"],["2026-10-10T03:00:00.001Z","ongoing"],["2026-10-19T18:58:59.999Z","ongoing"],["2026-10-19T18:59:00.000Z","ended"],["2026-10-19T18:59:00.001Z","ended"]] as const) assert.equal(eventPeriodStatus(period,new Date(instant)),expected,instant);
 assert.deepEqual(period,before);
 assert.equal(instantToJstInput(period.startAt),"2026-10-10T12:00");
 assert.equal(jstInputToInstant("2026-10-10T12:00"),period.startAt);
});
test("unknown maintenance times and approximate starts retain their stated precision",()=>{
 const p={startDate:"2026-10-09",startNote:"メンテナンス後（時刻未公表）",endAt:"2026-12-01T11:59+09:00"};
 assert.equal(eventPeriodStatus(p,new Date("2026-10-08T02:00:00Z")),"upcoming");
 assert.equal(eventPeriodStatus(p,new Date("2026-10-09T02:00:00Z")),"unknown");
 assert.equal(eventPeriodStatus(p,new Date("2026-10-13T02:00:00Z")),"ongoing");
 assert.ok(eventPeriodText(p).includes("時刻未公表"));
 assert.ok(!eventPeriodText(p).includes("00:00"));
 assert.ok(eventPeriodText({...p,startAt:"2026-10-10T12:00+09:00",startNote:"頃"}).includes("頃"));
});
test("permanent story and scheduled descents are distinct from limited campaigns",()=>{
 assert.equal(eventPeriodStatus({startAt:"2026-10-10T12:00+09:00",availability:"schedule"},new Date("2026-10-13T02:00:00Z")),"schedule");
 assert.equal(eventPeriodStatus({startAt:"2026-10-10T12:00+09:00",availability:"permanent"},new Date("2027-01-01T00:00:00Z")),"ongoing");
 assert.equal(eventPeriodStatus({},new Date("2026-10-13T02:00:00Z")),"unknown");
});
test("event and exchange deadlines remain independent and ending does not delete a published article",()=>{
 const e=event();e.activities.push({...e.activities[0],id:"exchange",kind:"exchange",name:"交換所",period:{startAt:"2026-10-10T12:00+09:00",endAt:"2026-10-24T03:59+09:00"}});
 const now=new Date("2026-10-21T00:00:00Z");
 assert.equal(eventPeriodStatus(e.activities[0].period,now),"ended");
 assert.equal(eventPeriodStatus(e.activities[1].period,now),"ongoing");
 assert.equal(articleEventStatus(e,now),"ongoing");
 assert.equal(articleEventStatus(e,new Date("2026-10-25T00:00:00Z")),"ended");
 const a=article();a.status="published";a.event={...e,publicationReviewed:true};
 assert.ok(isPublicArticle(a));assert.equal(a.status,"published");
});
test("drafts and private archives never enter general display even with a preview query",()=>{
 const a=article();assert.equal(isPublicArticle(a),false);a.status="archived";assert.equal(isPublicArticle(a),false);
 a.status="published";assert.equal(isPublicArticle(a),false);a.event!.publicationReviewed=true;assert.ok(isPublicArticle(a));
});
test("JST midnight switches date-only periods without mutating article data",()=>{
 const e=event();e.activities[0].period={startDate:"2026-10-09",startNote:"メンテナンス後",endAt:"2026-12-01T11:59+09:00"};const before=structuredClone(e);
 assert.equal(articleEventStatus(e,new Date("2026-10-08T14:59:59.999Z")),"upcoming");
 assert.equal(articleEventStatus(e,new Date("2026-10-08T15:00:00.000Z")),"unknown");
 assert.equal(articleEventStatus(e,new Date("2026-10-09T14:59:59.999Z")),"unknown");
 assert.equal(articleEventStatus(e,new Date("2026-10-09T15:00:00.000Z")),"ongoing");assert.deepEqual(e,before);
});
test("regular published articles and reviewed ended events remain readable independently of campaign dates",()=>{
 const regular={...article(),type:"quest_guide" as const,status:"published" as const,event:undefined};assert.ok(isPublicArticle(regular));
 const a=article();a.status="published";a.event!.publicationReviewed=true;a.event!.period={startAt:"2026-10-10T12:00+09:00",endAt:"2026-10-13T00:00+09:00"};const before=structuredClone(a);
 const now=new Date("2026-10-12T15:00:00.001Z");assert.equal(articleEventStatus(a.event!,now),"ended");assert.equal(eventPeriodStatus(a.event!.activities[0].period,now),"ongoing");
 assert.deepEqual([article(),regular,a].filter(isPublicArticle),[regular,a]);assert.deepEqual(a,before);
});
test("publication requires an explicit review, source, date and slug; changing type cannot bypass review",()=>{
 const a=article();a.status="published";assert.throws(()=>assertEventArticle(a),/公開前/);
 a.type="quest_guide";assert.throws(()=>assertEventArticle(a),/公開前/);assert.equal(isPublicArticle(a),false);
 a.event!.publicationReviewed=true;assert.doesNotThrow(()=>assertEventArticle(a));a.slug="";assert.throws(()=>assertEventArticle(a),/公開前/);
});
test("invalid dates, reversed ranges, unknown character IDs and unsafe source URLs are rejected",()=>{
 assert.equal(validEventInstant("2026-02-30T12:00+09:00"),false);assert.equal(validEventInstant("2026-10-10T25:00+09:00"),false);assert.equal(validEventInstant("2026-10-10T12:00Z"),false);
 assert.throws(()=>jstInputToInstant("2026-02-30T12:00"));assert.equal(jstInputToInstant(""),undefined);
 const a=article();assert.throws(()=>assertEventArticle(a,new Set(["other"])),/未登録/);
 a.event!.activities[0].period.endAt="2026-10-09T11:59+09:00";assert.throws(()=>assertEventArticle(a),/終了日時/);
 a.event!.activities[0].period={};a.event!.officialUrls=["javascript:alert(1)"];assert.throws(()=>assertEventArticle(a),/HTTPS/);
 assert.equal(isSafeArticleUrl("https://user:password@example.com/"),false);assert.equal(isSafeArticleUrl("data:text/html,x"),false);
});
test("legacy article blocks, unknown metadata, IDs and explicit empty arrays survive normalization",()=>{
 const original={meta:{updatedAt:"old",extra:"keep"},articles:[{...article(),type:"quest_guide",event:undefined,editorNote:"keep",sections:[{id:"empty",heading:"空欄",blocks:[]},{id:"custom",heading:"既存",extra:"keep",blocks:[{id:"future",type:"wordExamples",content:"既存本文",examples:["あい"]}]}]}]};
 const normalized=normalizeArticleFile(original);
 assert.deepEqual(normalized.articles[0].sections,original.articles[0].sections);
 assert.equal((normalized.articles[0] as unknown as {editorNote:string}).editorNote,"keep");
 assert.equal((normalized.meta as unknown as {extra:string}).extra,"keep");
});
test("malformed event metadata and a date-only reversed period are rejected before saving",()=>{
 const a=article();
 for(const eventValue of [{...event(),publicationReviewed:"true"},{...event(),history:[{checkedOn:"2026-02-30",note:"bad"}]},{...event(),activities:[{...event().activities[0],summary:{text:"bad"}}]}]){
  assert.throws(()=>assertEventArticle({...a,event:eventValue} as Article));
 }
 a.event!.activities[0].period={startDate:"2026-10-21",endAt:"2026-10-20T03:59+09:00"};assert.throws(()=>assertEventArticle(a),/終了日/);
});
test("duplicate article identities and URL names stop instead of dropping records",()=>{
 const a=article();assert.throws(()=>validateArticleFile({articles:[a,a]}),/重複/);
 assert.throws(()=>validateArticleFile({articles:[a,{...a,id:"second"}]}),/重複/);
});
test("atomic editing preserves other articles and stale editors cannot overwrite newer saves",async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),"kotodaman-article-test-"));
 try{
  const filePath=path.join(dir,"articles.json"),old={...article(),id:"old",slug:"old-event",updatedAt:"2026-01-01T00:00:00Z"};
  await writeFile(filePath,JSON.stringify({meta:{extra:"keep"},articles:[old,article()]}));
  const first=await readArticleSnapshot(filePath),changed={...article(),title:"編集済み"};
  await writeArticles({articles:[old,changed]},{filePath,expectedRevision:first.revision,characterIds:new Set(["real"])});
  const after=await readArticleSnapshot(filePath);assert.deepEqual(after.file.articles[0],old);assert.equal(after.file.articles[1].title,"編集済み");assert.notEqual(after.revision,first.revision);
  await assert.rejects(writeArticles({articles:[old,article()]},{filePath,expectedRevision:first.revision}),ArticleConflictError);
  assert.deepEqual((await readArticleSnapshot(filePath)).file,after.file);
 }finally{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith("kotodaman-article-test-"));await rm(dir,{recursive:true,force:true});}
});
test("broken article JSON stops loading and saving without replacing it with an empty file",async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),"kotodaman-article-test-"));const filePath=path.join(dir,"articles.json");
 try{await writeFile(filePath,"{broken");await assert.rejects(readArticleSnapshot(filePath));await assert.rejects(writeArticles({articles:[article()]},{filePath}));assert.equal(await readFile(filePath,"utf8"),"{broken");}
 finally{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith("kotodaman-article-test-"));await rm(dir,{recursive:true,force:true});}
});
