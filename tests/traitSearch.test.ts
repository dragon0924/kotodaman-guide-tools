import assert from "node:assert/strict";
import test from "node:test";
import { buildTraitSearchIndex, compactTraitSearchIndex, indexTraitSearchEvidence, matchesTraitSearch, parseReviewedTraitSearchSources, splitTraitHeading } from "../lib/traitSearch.ts";
import type { CharacterRecord, TraitTemplate } from "../lib/types";

const c = (id: string, raw: string[], blessing: string[] = []): Partial<CharacterRecord> => ({ id, name: id, sourceUrl: `https://example.com/${id}`, traitsRaw: raw, blessingTraitsRaw: blessing });
const build = (characters: Partial<CharacterRecord>[], manual: Partial<CharacterRecord>[] = [], templates: TraitTemplate[] = []) => buildTraitSearchIndex(characters, manual, templates);

test("explicit names remain distinct even when effects are shared", () => {
  const file = build([c("看破", ['デッキ条件「看破」敵全体被ダメージ増加小']), c("牽制", ['デッキ条件「牽制」敵全体被ダメ増加中(2)']), c("応援", ['デッキ条件「応援」味方ATKUP小(2)']), c("援護", ["援護(夢への後押し)"])]);
  const index = indexTraitSearchEvidence(file);
  for (const name of ["看破", "牽制", "応援", "援護"]) for (const id of index.keys()) assert.equal(matchesTraitSearch(index.get(id), [name]), id === name);
  assert.ok(matchesTraitSearch(index.get("看破"), [], ["被ダメージ増加"])); assert.ok(matchesTraitSearch(index.get("牽制"), [], ["被ダメージ増加"]));
});
test("prose, quoted targets and similar effects cannot invent a named trait", () => {
  const file = build([c("bad", ['①「看破」のキャラがいる場合、敵の被ダメージ増加', '「応援団」ATK10%UP', '「援護」グループのATK10%UP', 'デッキ条件「看破」と似た効果', '援護(名前)についての説明', '敵全体被ダメージ増加小', '①攻撃を受けた場合に20%の確率で反撃する'])]);
  assert.deepEqual(file.names, []);
  assert.ok(file.categories.some(c => c.label === "反撃"));
});
test("one prose-like title fragment does not suppress another explicitly named fragment", () => {
  const entry = indexTraitSearchEvidence(build([c("a", ['スマッシュブレイカー・ターン経過に応じて自身のATKUP小（4）・デッキ条件「看破」敵全体被ダメージ増加小'])])).get("a");
  assert.ok(matchesTraitSearch(entry, ["看破"]));
});
test("normal, blessing and raid ownership are independent, including mixed headings", () => {
  const file = build([c("mixed", ['トゲガード・大討伐条件火・水属性×ATK5UP・デッキ条件「看破」敵全体被ダメージ増加小'], ["モード・シフト"])]);
  const entry = indexTraitSearchEvidence(file).get("mixed");
  assert.ok(matchesTraitSearch(entry, ["normal:看破", "blessing:モード・シフト"], ["raid:ATK強化"]));
  assert.equal(matchesTraitSearch(entry, ["blessing:看破"]), false);
  assert.equal(matchesTraitSearch(entry, [], ["normal:ATK強化"]), false);
  assert.deepEqual(splitTraitHeading('文字変換「あ・い」・モード・シフト・大討伐条件火・水属性×ATK5UP'), ['文字変換「あ・い」', "モード・シフト", "大討伐条件火・水属性×ATK5UP"]);
});
test("name aliases normalize exactly and filters never use partial prose matches", () => {
  const entry = indexTraitSearchEvidence(build([c("mode", ["モード・シフト"])] )).get("mode");
  assert.ok(matchesTraitSearch(entry, ["モードシフト"])); assert.ok(matchesTraitSearch(entry, ["モード シフト"]));
  assert.equal(matchesTraitSearch(entry, ["モード"]), false); assert.equal(matchesTraitSearch(entry, ["看破"]), false);
});
test("explicit strength and target variants resolve to their named family without inventing names", () => {
  const file = build([c("a", [], ["HP基礎値中UP", "火属性キラー＋"])]);
  const entry = indexTraitSearchEvidence(file).get("a");
  assert.ok(matchesTraitSearch(entry, ["blessing:HP基礎値中UP", "blessing:火属性キラー＋"]));
  assert.ok(file.names.find(n => n.label === "HP基礎値UP")?.aliases.includes("HP基礎値中UP"));
});
test("AND, OR, categories, qualified cross-source conditions and clearing behave predictably", () => {
  const entry = indexTraitSearchEvidence(build([c("a", ['デッキ条件「看破」敵全体被ダメージ増加小'], ["モード・シフト"])] )).get("a");
  assert.equal(matchesTraitSearch(entry, ["看破", "応援"], [], "and"), false);
  assert.equal(matchesTraitSearch(entry, ["看破", "応援"], [], "or"), true);
  assert.equal(matchesTraitSearch(entry, ["看破"], ["被ダメージ増加"], "and"), true);
  assert.equal(matchesTraitSearch(entry, ["看破"], [], "and", "blessing"), false);
  assert.equal(matchesTraitSearch(entry, [], [], "and"), true); assert.equal(matchesTraitSearch(undefined, [], []), true);
});
test("effective manual text replaces auto text, including intentional empty overrides", () => {
  const a = c("a", ['デッキ条件「看破」敵全体被ダメージ増加小'], ["モード・シフト"]); const original = JSON.stringify(a);
  const file = build([a], [{ id: "a", traitsRaw: [], blessingTraitsRaw: ["文字変換「あ」"] }]);
  assert.equal(file.names.some(n => n.label === "看破"), false); assert.equal(file.names.some(n => n.label === "モード・シフト"), false);
  assert.ok(file.evidence.every(e => e.file === "data/characters.manual.json")); assert.equal(JSON.stringify(a), original);
});
test("structured templates provide typed effects without naming an inferred ability", () => {
  const templates: TraitTemplate[] = [{ id: "b", name: "祝福：ATK基礎値UP", template: "ATKの基礎値を{n}UP", sourceType: "blessingTrait", params: [] }];
  const file = build([{ ...c("a", []), traits: [{ templateId: "b", values: { n: 100 } }] }], [], templates);
  assert.deepEqual(file.names, []); assert.equal(file.categories.find(c => c.label === "ATK強化")?.counts.blessing, 1);
  assert.equal(file.evidence[0].field, "traits");
});
test("combined gimmick titles preserve super variants without equating them", () => {
  const file = build([c("a", ["スーパースマッシュ＆スーパーウォールブレイカー・心眼回避50％"])]);
  const entry = indexTraitSearchEvidence(file).get("a");
  assert.ok(matchesTraitSearch(entry, ["スーパースマッシュブレイカー", "スーパーウォールブレイカー", "心眼回避"]));
  assert.equal(matchesTraitSearch(entry, ["スマッシュブレイカー"]), false);
  const superKiller = indexTraitSearchEvidence(build([c("b", ["スーパー火属性キラー50％"])] )).get("b");
  assert.ok(matchesTraitSearch(superKiller, ["スーパー火属性キラー"])); assert.equal(matchesTraitSearch(superKiller, ["火属性キラー"]), false);
});
test("compact snapshots retain field references and exact catalog counts", () => {
  const file = build([c("a", ['デッキ条件「看破」敵全体被ダメージ増加小']), c("b", ['デッキ条件「看破」敵全体被ダメージ増加小'])]);
  const compact = compactTraitSearchIndex(file); assert.equal(compact.names.find(n => n.label === "看破")?.counts.normal, 2);
  assert.ok(compact.entries.every(e => e.references.some(r => r.field === "traitsRaw" && r.index === 0)));
});

test("explicit numeric gimmick headings and combined change guards remain searchable with source separation", () => {
  const file = build([c("b-komachi", ['スーパービリビリガード(500)・文字変換「し・ん・せ・い・び」'], ['スーパービリビリガード(300)']), c("grand", ['コピー＆チェンジガード・文字変換「ち・ょ・う・と・い」']), c("prose", ['①スーパービリビリガード(500)を持つ味方のATKを強化'])]);
  const index = indexTraitSearchEvidence(file);
  assert.ok(matchesTraitSearch(index.get("b-komachi"), ["normal:スーパービリビリガード", "blessing:スーパービリビリガード"]));
  assert.equal(matchesTraitSearch(index.get("b-komachi"), ["normal:ビリビリガード"]), false);
  assert.ok(matchesTraitSearch(index.get("grand"), ["コピーガード", "チェンジガード"]));
  assert.equal(matchesTraitSearch(index.get("grand"), ["blessing:コピーガード"]), false);
  assert.equal(matchesTraitSearch(index.get("prose"), ["スーパービリビリガード"]), false);
  assert.ok(file.names.find(n => n.label === "スーパービリビリガード")?.aliases.includes("スーパービリビリガード(500)"));
  const mixed = indexTraitSearchEvidence(build([c("gendo", ['ウォールブレイカー(福）・「エヴァンゲリオン」毒耐性5%'])])).get("gendo");
  assert.ok(matchesTraitSearch(mixed, ["ウォールブレイカー"]));
  assert.deepEqual(splitTraitHeading('ウォールブレイカー(福）・文字変換「し・い」'), ['ウォールブレイカー(福）', '文字変換「し・い」']);
});

test("newly added character text is indexed from current input even when a saved snapshot predates it", () => {
  const old = c("existing", ['デッキ条件「応援」味方ATKUP小(2)']);
  const before = build([old]);
  const after = build([old, c("new-mode", ['デッキ条件「応援」火・闇属性ATKUP中(2)・デッキ条件「看破」敵全体被ダメージ増加中'], ["モード・シフト"])]);
  assert.equal(before.characterCount, 1);
  const entry = indexTraitSearchEvidence(after).get("new-mode");
  assert.ok(matchesTraitSearch(entry, ["normal:応援", "normal:看破", "blessing:モード・シフト"]));
  assert.equal(matchesTraitSearch(entry, ["blessing:看破"]), false);
});

test("reviewed missing-field headers require exact identity and preserve explicit manual overrides", () => {
  const reviewed = parseReviewedTraitSearchSources({ version: 1, entries: [{ characterId: "grand", characterName: "grand", sourceUrl: "https://example.com/grand", source: "normal", checkedAt: "2026-10-12", headings: ['デッキ条件「応援」火・闇属性ATKUP中(2)・デッキ条件「看破」敵全体被ダメージ増加中&敵全体被ダメージ上限突破(+100000)'] }] });
  const character: Partial<CharacterRecord> = { id: "grand", name: "grand", sourceUrl: "https://example.com/grand", traits: [] };
  const before = JSON.stringify(character);
  const file = buildTraitSearchIndex([character], [], [], reviewed);
  const entry = indexTraitSearchEvidence(file).get("grand");
  assert.ok(matchesTraitSearch(entry, ["看破", "応援"], [], "and"));
  assert.equal(matchesTraitSearch(entry, ["blessing:看破", "blessing:応援"], [], "or"), false);
  assert.equal(matchesTraitSearch(entry, ["raid:看破"], [], "or"), false);
  assert.ok(file.evidence.every(e => e.file === "data/traitSearchReviewedSources.json" && e.field === "headings"));
  for (const changed of [{ ...character, sourceUrl: "https://example.com/other-form" }, { ...character, name: "grand(別形態)" }, { ...character, id: "other" }]) assert.deepEqual(buildTraitSearchIndex([changed], [], [], reviewed).names, []);
  assert.deepEqual(buildTraitSearchIndex([character], [{ id: "grand", traitsRaw: [] }], [], reviewed).names, []);
  const explicit = indexTraitSearchEvidence(buildTraitSearchIndex([character], [{ id: "grand", traitsRaw: ['デッキ条件「牽制」敵全体被ダメ増加小(2)'] }], [], reviewed)).get("grand");
  assert.equal(matchesTraitSearch(explicit, ["応援", "看破"], [], "or"), false);
  assert.ok(matchesTraitSearch(explicit, ["牽制"]));
  assert.equal(JSON.stringify(character), before);
  assert.throws(() => parseReviewedTraitSearchSources({ version: 1, entries: [...reviewed, ...reviewed] }), /duplicate/);
});
