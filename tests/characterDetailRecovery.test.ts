import test from "node:test";
import assert from "node:assert/strict";
import { applyCharacterDetailRecoveries, parseCharacterDetailRecoveries, type CharacterDetailRecovery } from "../lib/characterDetailRecovery.ts";
import { characterDetailsFromSections } from "../lib/characterDetailSections.ts";
import { buildTraitSearchIndex } from "../lib/traitSearch.ts";
import type { CharacterRecord } from "../lib/types";
import { explicitlyNoTraits } from "../lib/characterDetailDisplay.ts";
import { indexTraitSearchEvidence, matchesTraitSearch } from "../lib/traitSearch.ts";

const character: Partial<CharacterRecord> = { id: "a", name: "検証", sourceUrl: "https://gamewith.jp/kotodaman/article/show/123", imageUrl: "preserved.png", groups: ["保持"], kotowaza: [{level: 4, effect: "MAXのみ"}] };
const entry = (): CharacterDetailRecovery => ({ characterId: "a", characterName: "検証", sourceCharacterName: "検証", sourceUrl: character.sourceUrl!, checkedAt: "2026-10-18T01:00:00Z", sourceSha256: "a".repeat(64), fields: { superMove: { condition: "【4文字以上】", effect: "すごわざ本文" }, traitsRaw: ["デッキ条件「応援」味方ATKUP小", "デッキ条件「看破」敵全体被ダメージ増加小"], blessingTraitsRaw: ["文字変換「う」"] }, sectionHeadings: { superMove: "検証のわざ・すごわざ", traitsRaw: "検証の特性", blessingTraitsRaw: "検証の祝福特性" } });

test("confirmed absence is distinguished from missing text or a trait mentioning absence", () => {
  assert.ok(explicitlyNoTraits(["効果","なし"]));
  assert.ok(explicitlyNoTraits(["とくせいなし"]));
  assert.equal(explicitlyNoTraits(),false);
  assert.equal(explicitlyNoTraits(["効果"]),false);
  assert.equal(explicitlyNoTraits(["条件なしで攻撃する"]),false);
  assert.equal(explicitlyNoTraits(["なし","文字変換"]),false);
});

test("recovery fills missing detail without mutating manual, IDs, images, groups or MAX-only kotowaza", () => {
  const original = structuredClone(character);
  const data = entry(); const before = structuredClone(data);
  const result = applyCharacterDetailRecoveries([character], [data]);
  assert.deepEqual(result.characters[0], { ...character, ...data.fields });
  assert.deepEqual(character, original); assert.deepEqual(data, before);
  assert.deepEqual(result.applied[0].fields, ["superMove", "traitsRaw", "blessingTraitsRaw"]);
});

test("nonempty existing details and future manual edits always win", () => {
  const current = { ...character, ...entry().fields, superMove: { condition: "保存した条件", effect: "手動修正", conditions: [{type: "combo" as const, comboCount: 9}] } };
  const result = applyCharacterDetailRecoveries([current], [entry()]);
  assert.strictEqual(result.characters[0], current); assert.equal(result.applied.length, 0);
});

test("partial moves retain free and structured conditions while only effect is recovered", () => {
  const current = { ...character, superMove: { condition: "管理者の条件", conditions: [{type: "combo" as const, comboCount: 8}] } };
  const result = applyCharacterDetailRecoveries([current], [entry()]);
  assert.deepEqual(result.characters[0].superMove, { ...current.superMove, effect: "すごわざ本文" });
});

test("explicit manual empty arrays, null fields and blank effects are not overridden", () => {
  const manual = { id: "a", traitsRaw: [], blessingTraitsRaw: [], superMove: {effect: ""} };
  const current = { ...character, ...manual };
  assert.equal(applyCharacterDetailRecoveries([current], [entry()], [manual]).applied.length, 0);
  assert.ok(!applyCharacterDetailRecoveries([{...character,traitsRaw:["効果","なし"]}], [entry()], [{id:"a",traitsRaw:["効果","なし"]}]).applied.some(row=>row.fields.includes("traitsRaw")));
  assert.equal(applyCharacterDetailRecoveries([{ ...character, superMove: null } as unknown as Partial<CharacterRecord>], [entry()], [{id: "a", superMove: null} as unknown as Partial<CharacterRecord>]).characters[0].superMove, null);
});

test("identity requires ID, source URL and current form name together", () => {
  for (const override of [{id: "other"}, {name: "検証(別形態)"}, {sourceUrl: character.sourceUrl + "9"}]) {
    assert.equal(applyCharacterDetailRecoveries([{ ...character, ...override }], [entry()]).applied.length, 0);
  }
});

test("recovery schema rejects duplicates, unsupported fields, absent effects and unbounded source sections", () => {
  assert.equal(parseCharacterDetailRecoveries({version: 1, entries: [entry()]}).length, 1);
  for (const entries of [[entry(), entry()], [{...entry(), fields:{superMove:{condition:"条件だけ"}}}], [{...entry(), sectionHeadings:{...entry().sectionHeadings,traitsRaw:"別キャラの特性"}}], [{...entry(),fields:{imageUrl:"置き換え禁止"}}], [{...entry(),sourceUrl:"https://example.com/123"}]]) assert.throws(() => parseCharacterDetailRecoveries({version:1,entries}));
});

test("bounded tables retain long effects and repetitions without leaking blessing or following sections", () => {
  const effect = "①このとくせいを所持しているコトダマンがいる場合、味方を強化する。\n②次のターンも同じ効果を受ける";
  const result = characterDetailsFromSections("検証", [
    {heading:"検証の特性",rows:[["効果"],["援護(検証)\n"+effect],["繰り返し","繰り返し"]]},
    {heading:"検証の祝福特性",rows:[["効果(最大強化時)"],["文字変換「う」\n文字変換に「う」を追加する"]]},
    {heading:"別形態の特性",rows:[["混入しない"]]},
    {heading:"検証のわざ・すごわざ",rows:[["わざ名"],["【3文字以上】\n通常の効果"],["すごわざ名"],["【テーマ「天気」 or\n2文字以上12コンボ以上】\n敵全体に攻撃する。\n味方がいる場合、さらに攻撃する。"]]},
  ]);
  assert.deepEqual(result.fields.traitsRaw, ["援護(検証)", ...effect.split("\n"), "繰り返し", "繰り返し"]);
  assert.equal(result.fields.superMove?.effect, "敵全体に攻撃する。\n味方がいる場合、さらに攻撃する。");
  assert.ok(!result.fields.traitsRaw?.includes("文字変換「う」"));
  assert.equal(characterDetailsFromSections("検証",[{heading:"検証の祝福特性",rows:[["効果"],["なし"]]}]).fields.blessingTraitsRaw,undefined);
});

test("recovered text is searchable under its real source with provenance and AND matching", () => {
  const index = buildTraitSearchIndex([character], [], [], [], [entry()]);
  for (const name of ["応援","看破"]) assert.ok(index.evidence.some(e=>e.names.includes(name)&&e.source==="normal"&&e.file==="data/characterDetailRecoveries.json"));
  assert.ok(index.evidence.filter(e=>e.field==="blessingTraitsRaw").every(e=>e.source==="blessing"));
  assert.ok(!index.evidence.some(e=>e.names.includes("牽制")));
  const blocked = buildTraitSearchIndex([character], [{id:"a",traitsRaw:[]}], [], [], [entry()]);
  assert.ok(!blocked.evidence.some(e=>e.names.includes("看破")));
});

test("explicit super-move probability in a counter title is a parameter, not a prose name guess", () => {
  const file = buildTraitSearchIndex([
    {...character,id:"title",name:"見出し検証",traitsRaw:["バルーンガード・確定反撃（すごわざ30％）"]},
    {...character,id:"prose",name:"本文検証",traitsRaw:["①「確定反撃」の味方がいる場合、攻撃する"]},
    {...character,id:"other",name:"別名称検証",traitsRaw:["反撃(30%)"]},
  ], [], []);
  const index = indexTraitSearchEvidence(file);
  assert.ok(matchesTraitSearch(index.get("title"),["確定反撃"],["反撃"]));
  assert.equal(matchesTraitSearch(index.get("prose"),["確定反撃"]),false);
  assert.equal(matchesTraitSearch(index.get("other"),["確定反撃"]),false);
});
