import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { activityBodyBlocks, activitySectionId, activityEditorSection, eventEditorView, applyEventEditorPatch, eventArticleToc, eventArticleSources } from "../lib/articleEventContent.ts";
import { articleCharacterIds, articleImageSources, validateArticleRichContent } from "../lib/articleRichText.ts";
import { readArticleSnapshot, writeArticles, ArticleConflictError } from "../lib/articleStore.ts";
import { selectHomeEvents, homeEventTiming } from "../lib/homeEvents.ts";
import type { Article, ArticleEventActivity } from "../lib/types";
// Regression fixtures must remain stable while an administrator edits the real draft.
const original:Article={
  id:"event-fixture",title:"イベント本文の検証",slug:"event-fixture",type:"event_summary",status:"draft",
  createdAt:"2026-10-13T00:00:00Z",updatedAt:"2026-10-13T00:00:00Z",
  sections:[{id:"intro",heading:"概要",blocks:[{id:"intro-body",type:"paragraph",content:"導入文"}]},{id:"notes",heading:"補足",blocks:[]}],
  event:{name:"イベント検証用",officialUrls:["https://example.com/event"],lastCheckedOn:"2026-10-13",publicationReviewed:false,history:[],
    activities:["grand","free","login","panel","chicken","seki","koshu","caesar","karn","medal-quest","medal-exchange","grand-exchange","new-descents","setsuri","setsuri-ranking"].map((id):ArticleEventActivity=>({
      id,name:id,kind:"campaign",summary:id+"の本文",characterIds:[],officialUrl:"https://example.com/event",
      period:{startAt:"2026-10-10T12:00:00+09:00",endAt:"2026-12-01T11:59:00+09:00",availability:"limited"},
    })),
  },
};
const stored={articles:[{...original,id:"other-article",slug:"other-article",title:"変更しない記事"},original]};
const fixture=()=>structuredClone(original);
const apply=(a:Article,sections:ReturnType<typeof eventEditorView>["sections"])=>({...a,...applyEventEditorPatch(a,{sections})});

test("all 15 legacy campaigns enter the visual editor without changing stored text, periods or metadata",()=>{
  const a=fixture(),before=structuredClone(a),view=eventEditorView(a);
  assert.equal(view.sections.filter(s=>s.eventActivity).length,15);
  for(const activity of a.event!.activities)assert.equal(activityBodyBlocks(activity)[0].content,activity.summary);
  const next=apply(a,view.sections);assert.deepEqual(next,a);assert.deepEqual(a,before);
  assert.ok(next.event!.activities.every(a=>a.blocks===undefined));
});
test("campaign rich text has one editing source; only the edited campaign gains blocks and a plain fallback",()=>{
  const a=fixture(),view=eventEditorView(a),section=view.sections.find(s=>s.eventActivity?.id==="grand")!;
  section.heading="変更した施策見出し";section.blocks=[{id:"edited-body",type:"paragraph",content:"変更した本文",richText:{type:"doc",content:[{type:"paragraph",content:[{type:"text",text:"変更した本文",marks:[{type:"bold"},{type:"textStyle",attrs:{color:"#d32632",backgroundColor:"#fff2a8"}}]}]}]}}];
  const next=apply(a,view.sections),campaign=next.event!.activities.find(a=>a.id==="grand")!;
  assert.equal(campaign.name,section.heading);assert.equal(campaign.summary,"変更した本文");assert.deepEqual(campaign.blocks,section.blocks);
  assert.deepEqual(campaign.period,a.event!.activities[0].period);assert.deepEqual(next.sections,a.sections);
  assert.ok(next.event!.activities.filter(a=>a.id!=="grand").every(a=>a.blocks===undefined));
});
test("reordering, removing, restoring and adding campaigns preserves IDs and their independent schedules",()=>{
  const a=fixture(),view=eventEditorView(a),si=view.sections.findIndex(s=>s.eventActivity?.id==="grand");
  const [grand]=view.sections.splice(si,1);view.sections.splice(3,0,grand);
  const next=apply(a,view.sections);assert.equal(next.event!.activities[2].id,"grand");
  assert.deepEqual(next.event!.activities.find(x=>x.id==="grand")!.period,a.event!.activities[0].period);
  const removed=apply(next,view.sections.filter(s=>s!==grand));assert.equal(removed.event!.activities.length,14);
  const restored=apply(removed,view.sections);assert.deepEqual(restored.event!.activities,next.event!.activities);
  const newActivity:ArticleEventActivity={id:"new-campaign",name:"新しい施策",kind:"campaign",period:{availability:"limited"},summary:"",characterIds:[],officialUrl:""};
  assert.equal(apply(restored,[...view.sections,activityEditorSection(newActivity)]).event!.activities.length,16);
});
test("TOC follows campaign names and order, excludes the introduction and uses stable unique targets",()=>{
  const a=fixture(),toc=eventArticleToc(a);assert.equal(toc[0].label,a.event!.activities[0].name);
  assert.ok(!toc.some(e=>e.id==="section-"+a.sections[0].id));assert.equal(new Set(toc.map(e=>e.id)).size,toc.length);
  a.event!.activities.reverse();a.event!.activities[0].name="別の見出し";
  assert.equal(eventArticleToc(a)[0].label,"別の見出し");assert.equal(eventArticleToc(a)[0].id,activitySectionId(a.event!.activities[0].id));
});
test("explicitly empty campaign bodies stay empty and source URLs are deduplicated without losing references",()=>{
  const a=fixture(),activity=a.event!.activities[0];activity.blocks=[];
  assert.deepEqual(activityBodyBlocks(activity),[]);
  const urls=eventArticleSources(a);assert.equal(new Set(urls).size,urls.length);
  assert.ok(a.event!.activities.every(x=>!x.officialUrl||urls.includes(x.officialUrl)));
});
test("campaign images and character cards participate in media authorization and DB reference resolution",()=>{
  const a=fixture();a.event!.activities[0].blocks=[{id:"image",type:"image",content:"",image:{src:"/api/article-media/12345678-1234-1234-1234-123456789abc.webp",alt:"説明"}},{id:"card",type:"characterCard",content:"",characterIds:["real"]}];
  assert.ok(articleImageSources(a).includes(a.event!.activities[0].blocks[0].image!.src));assert.ok(articleCharacterIds(a).includes("real"));
  const ids=new Set([...articleCharacterIds(a)]);assert.doesNotThrow(()=>validateArticleRichContent(a,ids));ids.delete("real");assert.throws(()=>validateArticleRichContent(a,ids),/未登録/);
});
test("campaign bodies cannot bypass rich-text safety, uniqueness, publication review or date validation",()=>{
  const a=fixture();a.event!.activities[0].blocks=[{id:"unsafe",type:"paragraph",content:"",richText:{type:"doc",content:[{type:"script"}]}}];
  assert.throws(()=>validateArticleRichContent(a));
  a.event!.activities[0].blocks=[{id:a.sections[0].blocks[0].id,type:"paragraph",content:"duplicate"}];assert.throws(()=>validateArticleRichContent(a),/重複/);
  a.event!.activities[0].blocks=[{id:"safe",type:"paragraph",content:"",richText:{type:"doc",content:[{type:"paragraph"}]}}];
  a.status="published";a.contentReviewed=false;assert.throws(()=>validateArticleRichContent(a),/公開前/);
  a.status="draft";a.publishedOn="2026-02-30";assert.throws(()=>validateArticleRichContent(a),/公開日/);
});
test("rich campaign editing leaves home schedules, next deadlines and expiry unchanged",()=>{
  const a=fixture(),now=new Date("2026-10-14T12:00:00+09:00"),options={includeDrafts:true};
  const before=selectHomeEvents([a],now,options)[0];a.event!.activities[0].blocks=[{id:"body",type:"paragraph",content:"本文だけ変更"}];
  assert.deepEqual(selectHomeEvents([a],now,options)[0],before);assert.deepEqual(homeEventTiming(before,now),homeEventTiming(selectHomeEvents([a],now,options)[0],now));
  assert.equal(selectHomeEvents([a],new Date("2026-12-09T12:00:00+09:00"),options).length,0);
});
test("rich campaign saves roundtrip without changing another article and stale writes remain rejected",async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),"kotodaman-event-body-")),filePath=path.join(directory,"articles.json");
  try {
    await writeFile(filePath,JSON.stringify(stored));const snapshot=await readArticleSnapshot(filePath),a=fixture();
    a.event!.activities[0].blocks=activityBodyBlocks(a.event!.activities[0]);
    await writeArticles({...snapshot.file,articles:snapshot.file.articles.map(old=>old.id===a.id?a:old)},{filePath,expectedRevision:snapshot.revision});
    const saved=await readArticleSnapshot(filePath);assert.deepEqual(saved.file.articles.find(x=>x.id===a.id)!.event,a.event);
    assert.deepEqual(saved.file.articles.filter(x=>x.id!==a.id),snapshot.file.articles.filter(x=>x.id!==a.id));
    await assert.rejects(writeArticles(snapshot.file,{filePath,expectedRevision:snapshot.revision}),ArticleConflictError);
  } finally {assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith("kotodaman-event-body-"));await rm(directory,{recursive:true,force:true});}
});
