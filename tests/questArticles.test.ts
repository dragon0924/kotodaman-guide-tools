import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { assertQuestArticle, emptyArticleQuest, QUEST_AXIS_OPTIONS, questAxisText, questAxisValues, questHasAxis, questCountermeasureGroups, questSectionHasData, questBombCondition, questInputIssues, questReviewProgress, questTemplateSections, visibleQuestSections } from "../lib/questArticle.ts";
import { articleCharacterIds, articleImageSources, validateArticleRichContent } from "../lib/articleRichText.ts";
import { ArticleConflictError, readArticleSnapshot, validateArticleFile, writeArticles } from "../lib/articleStore.ts";
import { isPublicArticle } from "../lib/articleEvents.ts";
import { questUnassignedData, questWaveBody, questWaveData, questWaves, syncQuestWaveSections } from "../lib/questArticleLayout.ts";
import { clearMissingQuestEnemyReferences, planQuestEnemyCount, questWaveEnemyLayout } from "../lib/questEnemyLayout.ts";
import type { Article, QuestArticleMechanic, QuestArticleWave } from "../lib/types";

function article(): Article {
  let index = 0;
  return { id: "quest-test", title: "架空クエスト・検証専用", slug: "quest-test", type: "quest_guide", status: "draft", contentReviewed: false, toc: true, createdAt: "2026-10-15T00:00:00Z", updatedAt: "2026-10-15T00:00:00Z", sections: questTemplateSections(() => "unique-" + ++index), quest: emptyArticleQuest() };
}
function readyArticle(): Article {
  const a = article(), q = a.quest!;
  q.name = "架空クエスト"; q.boss = "架空ボス"; q.difficulty = "自由な難易度"; q.lastCheckedOn = "2026-10-15";
  q.enemies = [{ id: "enemy-1", name: "架空ボス", role: "boss", attributes: ["火", "光"], species: ["神"], hp: "", note: "" }];
  q.review = { overview: "confirmed", enemies: "confirmed", gimmicks: "none", ailments: "none", bombs: "none", boards: "none", characters: "none", teams: "none", phases: "none" };
  return a;
}
const mechanic = (): QuestArticleMechanic => ({ id: "shield", name: "シールド", category: "gimmick", occurrence: "present", importance: "required", counterTrait: "確認した対策名", counterTags: ["シールド", "Sシールド"], count: 2, durability: "確認した耐久", wave: "1", turn: "2", note: "検証用" });
const enemyWave=():QuestArticleWave=>({id:"enemy-wave",name:"WAVE 1",mechanicIds:[],boardIds:[],bombIds:[],phaseIds:[],hazardsState:"none"});

test("one to three enemies keep explicit left, center and right positions without guessing empty slots", () => {
  const enemies=readyArticle().quest!.enemies;
  for(const positions of [["center"],["left","right"],["left","center","right"]] as const){
    const wave={...enemyWave(),enemyCount:positions.length as 1|2|3,enemyPlacements:positions.map(position=>({enemyId:"enemy-1",position}))};
    const layout=questWaveEnemyLayout(wave,enemies)!;assert.equal(layout.complete,true);assert.equal(layout.positions.filter(p=>p.placement).length,positions.length);for(const slot of layout.positions)assert.equal(!!slot.placement,positions.some(p=>p===slot.position));assert.equal(layout.positions.find(p=>p.placement)?.placement?.enemy,enemies[0]);
  }
  const empty=planQuestEnemyCount(enemyWave(),3).patch;assert.deepEqual(empty.enemyPlacements,Array.from({length:3},()=>({enemyId:"",position:"unknown"})));assert.equal(questWaveEnemyLayout({...enemyWave(),...empty},enemies)!.complete,false);
});

test("count reductions identify populated slots before removal and never mutate shared enemy definitions", () => {
  const wave:QuestArticleWave={...enemyWave(),enemyCount:3,enemyPlacements:[{enemyId:"enemy-1",position:"left"},{enemyId:"enemy-1",position:"center"},{enemyId:"enemy-1",position:"right"}]},before=structuredClone(wave);
  const plan=planQuestEnemyCount(wave,1);assert.equal(plan.removed.length,2);assert.deepEqual(wave,before);assert.deepEqual(plan.patch.enemyPlacements,[before.enemyPlacements![0]]);
  const expanded=planQuestEnemyCount({...wave,...plan.patch},3);assert.deepEqual(expanded.patch.enemyPlacements[0],before.enemyPlacements![0]);assert.equal(expanded.patch.enemyPlacements[1].position,"unknown");assert.deepEqual(planQuestEnemyCount(wave,undefined).patch.enemyPlacements,before.enemyPlacements);
  assert.equal(planQuestEnemyCount({...enemyWave(),...expanded.patch},1).removed.length,0);
});

test("enemy layouts reject invalid counts, duplicate positions and dangling IDs while unfinished drafts stay editable", () => {
  const a=readyArticle(),w=enemyWave();a.quest!.waves=[w];let seq=0;a.sections=syncQuestWaveSections(a.sections,[w],()=>"enemy-body-"+(++seq));
  const valid:Partial<QuestArticleWave>={enemyCount:2,enemyPlacements:[{enemyId:"enemy-1",position:"left"},{enemyId:"enemy-1",position:"right"}]};Object.assign(w,valid);assert.doesNotThrow(()=>validateArticleFile({articles:[a]}));
  for(const invalid of [{enemyCount:0},{enemyCount:4},{enemyCount:1.5},{enemyCount:"2"},{enemyPlacements:[{enemyId:"missing",position:"left"}]},{enemyPlacements:[{enemyId:"enemy-1",position:"left"},{enemyId:"enemy-1",position:"left"}]},{enemyPlacements:[{enemyId:"enemy-1",position:"top"}]}]){Object.assign(w,valid,invalid);assert.throws(()=>validateArticleFile({articles:[a]}),/敵/);}
  Object.assign(w,{enemyCount:2,enemyPlacements:[{enemyId:"",position:"unknown"}]});assert.doesNotThrow(()=>validateArticleFile({articles:[a]}));assert.ok(questInputIssues(a.quest!).some(i=>i.key==="enemies"&&i.severity==="error"));a.status="published";a.contentReviewed=true;assert.equal(isPublicArticle(a),false);
  Object.assign(w,valid);assert.equal(isPublicArticle(a),true);
});

test("removing an enemy clears only its references and keeps slot positions, counts and other WAVE data", () => {
  const enemies=readyArticle().quest!.enemies,wave:QuestArticleWave={...enemyWave(),enemyCount:2,enemyPlacements:[{enemyId:"enemy-1",position:"left"},{enemyId:"deleted-enemy",position:"right"}]},before=structuredClone(wave),legacy=enemyWave();
  const result=clearMissingQuestEnemyReferences([wave,legacy],enemies);assert.equal(result[0].enemyCount,2);assert.deepEqual(result[0].enemyPlacements,[before.enemyPlacements![0],{enemyId:"",position:"right"}]);assert.equal(result[1],legacy);assert.deepEqual(wave,before);
});

test("legacy WAVE enemy data is never guessed and changing placements preserves both Tiptap bodies", () => {
  const a=readyArticle(),wave=enemyWave();a.quest!.waves=[wave];let seq=0;a.sections=syncQuestWaveSections(a.sections,[wave],()=>"body-"+(++seq));assert.equal(questWaveEnemyLayout(wave,a.quest!.enemies),undefined);assert.equal(Object.hasOwn(wave,"enemyPlacements"),false);
  questWaveBody(a,wave.id,"points")!.blocks[0].content="既存の攻略本文";questWaveBody(a,wave.id,"notes")!.blocks[0].content="既存の注意点";const before=structuredClone(a.sections);
  Object.assign(wave,{enemyCount:1,enemyPlacements:[{enemyId:"enemy-1",position:"center"}]});assert.deepEqual(syncQuestWaveSections(a.sections,[wave],()=>"unused"),before);assert.equal(questInputIssues(a.quest!).some(i=>i.key==="enemies"&&i.severity==="error"),false);
});

test("multiple quest axes include small kana and unrestricted choices and participate in input checks", () => {
  const a=readyArticle(),q=a.quest!;
  assert.deepEqual(Object.values(QUEST_AXIS_OPTIONS),["い軸","う軸","ゃゅょ軸","なんでも"]);
  q.axes=["i","u","smallKana","any"];
  assert.equal(questAxisText(q),"い軸 ／ う軸 ／ ゃゅょ軸 ／ なんでも");assert.equal(questHasAxis(q),true);assert.equal(questSectionHasData(q,"boards"),true);
  assert.ok(questInputIssues(q).some(i=>i.key==="boards"&&i.message.includes("該当なし")));
  q.review.boards="confirmed";assert.ok(!questInputIssues(q).some(i=>i.key==="boards"));assert.doesNotThrow(()=>assertQuestArticle(a));
  q.axes=[];q.review.boards="none";assert.equal(questAxisText(q),"未確認");assert.equal(questHasAxis(q),false);assert.ok(!questInputIssues(q).some(i=>i.key==="boards"));
});

test("legacy axes are read without migration and explicit empty axes override the old value", () => {
  const q=readyArticle().quest!;delete q.axes;
  for(const axis of ["unknown","i","u","mixed","other"] as const){q.axis=axis;const before=structuredClone(q);assert.equal(questAxisText(q),({unknown:"未確認",i:"い軸",u:"う軸",mixed:"混合",other:"その他"})[axis]);assert.deepEqual(questAxisValues(q),axis==="i"||axis==="u"?[axis]:[]);assert.deepEqual(q,before);}
  q.axis="mixed";q.axes=[];assert.equal(questAxisText(q),"未確認");assert.equal(questSectionHasData(q,"boards"),false);assert.equal(q.axis,"mixed");
  q.axes=["u","smallKana"];assert.equal(questAxisText(q),"う軸 ／ ゃゅょ軸");assert.equal(q.axis,"mixed");
});

test("axis payloads reject duplicates, removed choices and malformed arrays", () => {
  const a=readyArticle();
  for(const value of [["i","i"],["mixed"],["other"],["unknown"],["i",null],"i",{}]){a.quest!.axes=value as NonNullable<Article["quest"]>["axes"];assert.throws(()=>assertQuestArticle(a),/文字軸/);}
});

test("countermeasure tables separate ailments while preserving every category, row and uncertainty", () => {
  const rows:QuestArticleMechanic[]=[mechanic(),{...mechanic(),id:"poison",name:"毒",category:"ailment",occurrence:"unknown"},{...mechanic(),id:"barrier",category:"barrier",occurrence:"absent"},{...mechanic(),id:"field",category:"field"},{...mechanic(),id:"custom",category:"other"}];
  const before=structuredClone(rows),groups=questCountermeasureGroups(rows);
  assert.deepEqual(groups.map(g=>g.label),["ギミックの対策早見表","状態異常の対策早見表"]);assert.deepEqual(groups[0].rows.map(r=>r.id),["shield","barrier","field","custom"]);assert.deepEqual(groups[1].rows.map(r=>r.id),["poison"]);
  assert.equal(groups[1].rows[0],rows[1]);assert.equal(groups[0].rows[1].occurrence,"absent");assert.equal(groups[1].rows[0].occurrence,"unknown");assert.deepEqual(rows,before);assert.deepEqual(questCountermeasureGroups([]),[]);assert.equal(questCountermeasureGroups([rows[1]]).length,1);
});

test("legacy WAVE grouping is read-only and never interprets free bomb timing or ambiguous ranges", () => {
  const q=readyArticle().quest!;q.mechanics=[mechanic(),{...mechanic(),id:"range",wave:"1～3"}];q.phases=[{id:"p",name:"後半",wave:"WAVE 2",turn:"",trigger:"",actions:"検証",response:"",mechanicIds:[]}];
  q.bombs=[{id:"bomb",kind:"タイムボム",timing:"WAVE1の2ターン目",condition:{theme:"",text:"検証"},success:"",failure:"",method:""}];
  const original=structuredClone(q),waves=questWaves(q);assert.deepEqual(waves.map(w=>w.name),["WAVE 2","WAVE 1"]);
  assert.equal(questUnassignedData(q,waves).mechanics[0].id,"range");assert.equal(questUnassignedData(q,waves).bombs.length,1);assert.deepEqual(q,original);
});
test("one, two and four WAVE definitions retain custom names, order and shared references without copying content", () => {
  const q=readyArticle().quest!;q.mechanics=[mechanic()];
  for(const count of [1,2,4]){q.waves=Array.from({length:count},(_,i)=>({id:"w"+i,name:"独自WAVE名 "+i,mechanicIds:["shield"],boardIds:[],bombIds:[],phaseIds:[]}));assert.equal(questWaves(q).length,count);assert.equal(questWaveData(q,q.waves[0]).mechanics[0],q.mechanics[0]);assert.equal(questUnassignedData(q,q.waves).mechanics.length,0);}
  q.waves!.reverse();assert.equal(questWaves(q)[0].id,"w3");
});
test("WAVE names and ordering can change while both Tiptap bodies and all original sections remain intact", () => {
  const a=readyArticle(),original=structuredClone(a.sections);let seq=0;const makeId=()=>"wave-id-"+(++seq);
  a.quest!.waves=[{id:"w",name:"WAVE 1",mechanicIds:[],boardIds:[],bombIds:[],phaseIds:[]}];a.sections=syncQuestWaveSections(a.sections,a.quest!.waves,makeId);
  const points=questWaveBody(a,"w","points")!;points.blocks[0].richText={type:"doc",content:[{type:"paragraph",content:[{type:"text",text:"重要",marks:[{type:"bold"}]}]}]};
  const saved=structuredClone(points.blocks);a.quest!.waves[0].name="最終WAVE";a.sections=syncQuestWaveSections(a.sections,a.quest!.waves,makeId);
  assert.deepEqual(questWaveBody(a,"w","points")!.blocks,saved);assert.equal(questWaveBody(a,"w","points")!.heading,"最終WAVE · 攻略ポイント");assert.deepEqual(a.sections.slice(0,original.length),original);assert.doesNotThrow(()=>validateArticleFile({articles:[a]}));
});
test("WAVE references, duplicate bodies and invalid display modes are rejected before saving", () => {
  const a=readyArticle();a.quest!.waves=[{id:"w",name:"WAVE 1",mechanicIds:["missing"],boardIds:[],bombIds:[],phaseIds:[]}];
  assert.throws(()=>assertQuestArticle(a),/参照/);a.quest!.waves[0].mechanicIds=[];assert.throws(()=>assertQuestArticle(a),/構造/);
  let i=0;a.sections=syncQuestWaveSections(a.sections,a.quest!.waves,()=>"id"+(++i));a.sections.push({...questWaveBody(a,"w","notes")!,id:"duplicate"});assert.throws(()=>assertQuestArticle(a),/重複/);
  a.sections.pop();a.quest!.boards=[{id:"b",label:"",pattern:"",wave:"",turn:"",phase:"",words:[],behavior:"",display:"invalid" as "both"}];assert.throws(()=>assertQuestArticle(a),/表示方法/);
});
test("boss, reward and WAVE body links share DB identities and all new image references join draft protection", () => {
  const a=readyArticle(),q=a.quest!;const image={src:"/images/qa-only.webp",alt:"検証"};q.bossCharacterId="boss";q.bossImage=image;q.mechanics=[{...mechanic(),icon:image}];q.drops=[{id:"d",kind:"character",characterId:"drop",name:"",condition:"検証",image}];
  q.waves=[{id:"w",name:"WAVE 1",mechanicIds:["shield"],boardIds:[],bombIds:[],phaseIds:[]}];let i=0;a.sections=syncQuestWaveSections(a.sections,q.waves,()=>"wid"+(++i));questWaveBody(a,"w","points")!.blocks=[{id:"card",type:"characterCard",content:"",characterIds:["link"]}];
  assert.deepEqual(new Set(articleCharacterIds(a)),new Set(["boss","drop","link"]));assert.equal(articleImageSources(a).filter(src=>src===image.src).length,3);
  assert.throws(()=>assertQuestArticle(a,new Set(["boss"])),/キャラID/);assert.doesNotThrow(()=>validateArticleRichContent(a,new Set(["boss","drop","link"])));
  q.mechanics[0].icon={...image,src:"javascript:alert(1)"};assert.throws(()=>validateArticleRichContent(a),/画像URL/);
});
test("new optional data cannot turn unconfirmed rewards or WAVE hazards into a verified absence", () => {
  const q=readyArticle().quest!;q.drops=[{id:"d",kind:"item",characterId:"",name:"確認した報酬",condition:""}];q.dropsState="none";
  assert.ok(questInputIssues(q).some(i=>i.message.includes("ドロップ報酬の該当なし")));q.dropsState="confirmed";
  q.waves=[{id:"w",name:"WAVE 1",mechanicIds:["shield"],boardIds:[],bombIds:[],phaseIds:[],hazardsState:"none"}];assert.ok(questInputIssues(q).some(i=>i.message.includes("WAVE 1")));
});

test("new drafts retain unknown versus none, omit invented numbers and can save unfinished", () => {
  const a = article(); assert.doesNotThrow(() => validateArticleFile({ articles: [a] }));
  assert.equal(a.quest!.stamina, undefined); assert.equal(a.quest!.review.bombs, "unconfirmed");
  assert.equal(questReviewProgress(a.quest!).percent, 0);
  const missing = questInputIssues(a.quest!); assert.ok(missing.some(i => i.key === "bombs" && i.severity === "error"));
  a.quest!.review.bombs = "none"; assert.ok(!questInputIssues(a.quest!).some(i => i.key === "bombs"));
  assert.equal(questReviewProgress(a.quest!).reviewed, 1);
});
test("a reviewed absence needs no invented optional rows and optional unknowns remain warnings", () => {
  const a = readyArticle(); assert.equal(questInputIssues(a.quest!).length, 0);
  a.quest!.review.teams = "unconfirmed";
  assert.ok(questInputIssues(a.quest!).every(i => i.severity === "warning"));
  a.status = "published"; a.contentReviewed = true; assert.equal(isPublicArticle(a), true);
});
test("publication cannot bypass unknown core data or preview review through a type change", () => {
  const a = readyArticle(); a.status = "published";
  assert.throws(() => validateArticleFile({ articles: [a] }), /プレビュー/); assert.equal(isPublicArticle(a), false);
  a.contentReviewed = true; a.quest!.review.bombs = "unconfirmed";
  assert.throws(() => assertQuestArticle(a), /ボム/); assert.equal(isPublicArticle(a), false);
  a.quest!.review.bombs = "none"; assert.doesNotThrow(() => assertQuestArticle(a)); assert.ok(isPublicArticle(a));
  a.type = "beginner_guide"; assert.throws(() => assertQuestArticle(a), /記事タイプ/); assert.equal(isPublicArticle(a), false);
});
test("appearance, absence and unknown are distinct and cannot contradict an overall none", () => {
  const a = readyArticle(), q = a.quest!; q.mechanics = [mechanic()];
  assert.ok(questInputIssues(q).some(i => i.key === "gimmicks"));
  q.mechanics[0].occurrence = "absent"; assert.equal(questInputIssues(q).length, 0);
  q.mechanics[0].occurrence = "unknown"; q.review.gimmicks = "confirmed";
  assert.ok(questInputIssues(q).some(i => i.message.includes("未確認")));
});
test("structured bomb conditions preserve counts, timing and free text without inferring missing values", () => {
  const bomb = { id: "bomb", kind: "タイムボム", timing: "WAVE1・2ターン目", turnLimit: 2, condition: { minWordLength: 5, requiredCount: 3, theme: "", text: "同時解除の例外も記録" }, success: "成功時の記録", failure: "失敗時の記録", method: "検証手順" };
  const q = article().quest!; q.bombs = [bomb, { ...bomb, id: "bomb-2", kind: "奪い合いボックス", turnLimit: undefined }];
  assert.equal(questBombCondition(bomb), "2ターン以内に5文字以上のことばを3回 ／ 同時解除の例外も記録");
  assert.equal(q.bombs[1].turnLimit, undefined); assert.deepEqual(JSON.parse(JSON.stringify(q)).bombs[0], bomb);
});
test("empty optional sections are omitted while order, edited headings and free rich content remain canonical", () => {
  const a = readyArticle(); assert.deepEqual(visibleQuestSections(a).map(s => s.questSection), ["overview", "notes"]);
  const points = a.sections.find(s => s.questSection === "points")!; points.heading = "自分で編集した見出し";
  points.blocks[0].richText = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "手順", marks: [{ type: "textStyle", attrs: { color: "#ff0000" } }] }] }] };
  a.sections = [points, ...a.sections.filter(s => s !== points)];
  assert.equal(visibleQuestSections(a)[0].heading, "自分で編集した見出し"); assert.doesNotThrow(() => validateArticleFile({ articles: [a] }));
});
test("unconfirmed recommendations are private preview candidates and all links use stable DB IDs", () => {
  const a = readyArticle(), q = a.quest!;
  q.recommendations = [{ id: "r1", characterId: "known-form-a", role: "leader", reason: "リンク検証のみ", confirmed: false }];
  q.teams = [{ id: "t1", name: "検証編成", slots: ["known-form-b", ...Array(11).fill(null)], note: "" }];
  assert.deepEqual(articleCharacterIds(a), ["known-form-a", "known-form-b"]);
  assert.ok(!visibleQuestSections(a).some(s => s.questSection === "characters"));
  assert.ok(visibleQuestSections(a, true).some(s => s.questSection === "characters"));
  assert.doesNotThrow(() => assertQuestArticle(a, new Set(["known-form-a", "known-form-b"])));
  assert.throws(() => assertQuestArticle(a, new Set(["known-form-a"])), /登録済みキャラ/);
  q.teams[0].slots.pop(); assert.throws(() => assertQuestArticle(a), /12枠/);
});
test("board media participates in private media access and responsive image validation", () => {
  const a = article(); a.quest!.boards = [{ id: "b1", label: "盤面A", pattern: "□ う □ □ ん □ □", wave: "1", turn: "2", phase: "後半", words: ["記録した例"], behavior: "変換の記録", image: { src: "/api/article-media/12345678-1234-1234-1234-123456789abc.webp", alt: "架空盤面", widthPercent: 60, mobileWidthPercent: 100 } }];
  assert.deepEqual(articleImageSources(a), [a.quest!.boards[0].image!.src]); assert.doesNotThrow(() => validateArticleRichContent(a));
  a.quest!.boards[0].image!.mobileWidthPercent = 101; assert.throws(() => validateArticleRichContent(a), /スマホ画像幅/);
  a.quest!.boards[0].image!.mobileWidthPercent = 100; a.quest!.boards[0].image!.src = "javascript:alert(1)"; assert.throws(() => validateArticleRichContent(a));
});
test("dangerous URLs, invalid counts, bad dates, dangling mechanics and duplicate sections are rejected", () => {
  const a = readyArticle(), q = a.quest!;
  q.sources = ["javascript:alert(1)"]; assert.throws(() => assertQuestArticle(a), /HTTPS/);
  q.sources = ["https://example.com/source", ""]; q.lastCheckedOn = "2026-02-30"; assert.throws(() => assertQuestArticle(a), /確認日/);
  q.lastCheckedOn = "2026-10-15"; q.stamina = -1; assert.throws(() => assertQuestArticle(a), /体力/); delete q.stamina;
  q.phases = [{ id: "phase", name: "後半", wave: "1", turn: "3", trigger: "HP条件", actions: "記録した行動", mechanicIds: ["missing"], response: "記録した対処" }];
  assert.throws(() => assertQuestArticle(a), /関連ギミック/); q.phases = [];
  a.sections[1].questSection = a.sections[0].questSection; assert.throws(() => assertQuestArticle(a), /構造/);
});
test("an explicitly selected character is still not a verified recommendation", () => {
  const a = readyArticle(); a.quest!.review.characters = "confirmed";
  a.quest!.recommendations = [{ id: "r", characterId: "known", role: "sub", reason: "検証した理由", confirmed: false }];
  assert.ok(questInputIssues(a.quest!).some(i => i.key === "characters" && i.severity === "error"));
  a.quest!.recommendations[0].confirmed = true; assert.ok(!questInputIssues(a.quest!).some(i => i.key === "characters"));
});
test("save and reload preserve multiple boards, bombs, twelve slots and every old article without migration", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "kotodaman-quest-")), filePath = path.join(dir, "articles.json");
  const original = await readFile("data/articles.json");
  try {
    await writeFile(filePath, original); const before = await readArticleSnapshot(filePath);
    const a = article(), q = a.quest!; q.mechanics = [mechanic()]; q.axes=["i","smallKana","any"];
    q.enemies=readyArticle().quest!.enemies;q.waves=[1,2,3].map(count=>({...enemyWave(),id:"save-wave-"+count,name:"WAVE "+count,enemyCount:count as 1|2|3,enemyPlacements:(["left","center","right"] as const).slice(0,count).map(position=>({enemyId:"enemy-1",position}))}));let bodyId=0;a.sections=syncQuestWaveSections(a.sections,q.waves,()=>"saved-body-"+(++bodyId));
    q.boards = ["A", "B"].map((label, i) => ({ id: "board-" + i, label, pattern: "□ う □ □ ん □ □", wave: "1", turn: String(i + 1), phase: "確認用", words: ["うん"], behavior: "" }));
    q.bombs = ["タイムボム", "押し付けボム"].map((kind, i) => ({ id: "bomb-" + i, kind, timing: "2ターン目", turnLimit: 2, condition: { minWordLength: 5, requiredCount: 3, theme: "", text: "自由な条件" }, success: "記録", failure: "記録", method: "記録" }));
    q.teams = [{ id: "team", name: "検証", slots: ["known", ...Array(11).fill(null)], note: "" }];
    await writeArticles({ ...before.file, articles: [...before.file.articles, a] }, { filePath, expectedRevision: before.revision, characterIds: new Set(["known",...before.file.articles.flatMap(articleCharacterIds)]) });
    const saved = await readArticleSnapshot(filePath), loaded = saved.file.articles.find(x => x.id === a.id)!;
    assert.deepEqual(loaded.quest, q); assert.deepEqual(loaded.sections, a.sections);
    assert.deepEqual(saved.file.articles.slice(0, -1), before.file.articles);
    await assert.rejects(writeArticles(before.file, { filePath, expectedRevision: before.revision }), ArticleConflictError);
    assert.deepEqual(await readFile("data/articles.json"), original);
  } finally { assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir())); assert.ok(path.basename(dir).startsWith("kotodaman-quest-")); await rm(dir, { recursive: true, force: true }); }
});
