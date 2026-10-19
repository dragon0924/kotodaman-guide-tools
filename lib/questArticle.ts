import { GIMMICK_OPTIONS, COMBINED_GIMMICK_OPTIONS } from "./gimmicks.ts";
import { QUEST_ENEMY_POSITIONS, questWaveEnemyLayout } from "./questEnemyLayout.ts";
import type { Article, ArticleBlock, ArticleQuest, ArticleSection, QuestArticleAxis, QuestArticleMechanic, QuestArticleSectionKey, QuestReviewKey } from "./types";

export const QUEST_SECTIONS: Record<QuestArticleSectionKey, string> = {
  overview: "クエスト概要", hazards: "敵属性・ギミック・状態異常", points: "攻略の重要ポイント",
  boards: "盤面と文字軸", bombs: "ボム・特殊条件", characters: "適正キャラクター",
  teams: "おすすめ編成", phases: "WAVE・ターン別攻略", notes: "補足・関連情報",
};
export const QUEST_REVIEW_LABELS: Record<QuestReviewKey, string> = {
  overview: "基本情報", enemies: "敵の情報", gimmicks: "ギミック・バリア等", ailments: "状態異常",
  boards: "盤面・文字軸", bombs: "ボム・特殊条件", characters: "適正キャラ", teams: "おすすめ編成", phases: "敵の行動・フェーズ",
};
export const QUEST_REVIEW_STATES = { unconfirmed: "未確認", confirmed: "確認済み・入力済み", none: "該当なし" };
export const QUEST_AXIS_LABELS = { unknown: "未確認", i: "い軸", u: "う軸", mixed: "混合", other: "その他" };
export const QUEST_AXIS_OPTIONS: Record<QuestArticleAxis, string> = { i: "い軸", u: "う軸", smallKana: "ゃゅょ軸", any: "なんでも" };
// axes is authoritative when present, including an explicit empty selection.
// Retain the old scalar without guessing what mixed/other meant.
export function questAxisValues(quest: ArticleQuest): QuestArticleAxis[] {
  return quest.axes ?? (quest.axis === "i" || quest.axis === "u" ? [quest.axis] : []);
}
export function questAxisText(quest: ArticleQuest): string {
  return quest.axes === undefined ? QUEST_AXIS_LABELS[quest.axis] : quest.axes.map(axis => QUEST_AXIS_OPTIONS[axis]).join(" ／ ") || "未確認";
}
export function questHasAxis(quest: ArticleQuest): boolean {
  return quest.axes === undefined ? quest.axis !== "unknown" : quest.axes.length > 0;
}
export function questCountermeasureGroups(mechanics: QuestArticleMechanic[]) {
  return [
    { key: "gimmicks", label: "ギミックの対策早見表", rows: mechanics.filter(m => m.category !== "ailment") },
    { key: "ailments", label: "状態異常の対策早見表", rows: mechanics.filter(m => m.category === "ailment") },
  ].filter(group => group.rows.length > 0);
}
export const QUEST_IMPORTANCE = { unknown: "未確認", required: "必須", recommended: "推奨", unnecessary: "対策不要" };
export const QUEST_OCCURRENCE = { present: "出現する", absent: "出現しない", unknown: "未確認" };
export const QUEST_MECHANIC_CATEGORIES = { gimmick: "ギミック", ailment: "状態異常", barrier: "バリア", field: "フィールド", other: "その他" };
export const QUEST_GIMMICKS = GIMMICK_OPTIONS;
export const QUEST_COUNTER_TAGS = COMBINED_GIMMICK_OPTIONS;
export const QUEST_AILMENTS = ["毒", "混乱", "睡眠", "呪い", "汚染", "炎上", "改造", "衰弱", "変異", "消去"];
export const QUEST_ATTRIBUTE_OPTIONS = ["火", "水", "木", "光", "闇", "冥", "天", "虹"];
export const QUEST_SPECIES_OPTIONS = ["神", "英雄", "龍", "物", "獣", "霊", "魔", "妖"];
export const QUEST_DIFFICULTIES = ["中級", "上級", "超級", "魔級", "破滅級"];
export const QUEST_BOMB_KINDS = ["タイムボム", "奪い合いボックス", "押し付けボム"];
export const QUEST_REVIEW_REQUIRED = new Set<QuestReviewKey>(["overview", "enemies", "gimmicks", "ailments", "boards", "bombs"]);
export function emptyArticleQuest(): ArticleQuest {
  return {
    version: 1, name: "", boss: "", difficulty: "", category: "", relatedEventArticleId: "", participation: "", lastCheckedOn: "", sources: [],
    review: Object.fromEntries(Object.keys(QUEST_REVIEW_LABELS).map(key => [key, "unconfirmed"])) as ArticleQuest["review"],
    enemies: [], mechanics: [], bombs: [], axis: "unknown", axes: [], axisNote: "", boards: [], phases: [], recommendations: [], teams: [],
  };
}
export function questTemplateSections(makeId: () => string): ArticleSection[] {
  return Object.entries(QUEST_SECTIONS).map(([key, heading]) => ({ id: makeId(), heading, questSection: key as QuestArticleSectionKey, blocks: [{ id: makeId(), type: "paragraph", content: "" }] }));
}
export function questSectionAnchor(key: QuestArticleSectionKey) { return "quest-" + key; }
export function questBombCondition(bomb: ArticleQuest["bombs"][number]) {
  const subject = [bomb.condition.minWordLength !== undefined ? `${bomb.condition.minWordLength}文字以上のことば` : "", bomb.condition.theme].filter(Boolean).join(" / ");
  const repeated = subject + (bomb.condition.requiredCount !== undefined ? `${subject ? "を" : ""}${bomb.condition.requiredCount}回` : "");
  const condition = [repeated, bomb.condition.text].filter(Boolean).join(" ／ ");
  return (bomb.turnLimit !== undefined ? `${bomb.turnLimit}ターン以内${condition ? "に" : ""}` : "") + condition;
}
export function questBlocksHaveContent(blocks: ArticleBlock[]) {
  const text = (node: { text?: string; content?: Array<{ text?: string; content?: unknown[] }> }): string => node.text ?? node.content?.map(n => text(n as typeof node)).join("") ?? "";
  return blocks.some(b => ["image", "characterCard", "table"].includes(b.type) || (b.richText ? text(b.richText).trim() : b.content.trim()));
}
export function questSectionHasData(quest: ArticleQuest, key: QuestArticleSectionKey, preview = false): boolean {
  switch (key) {
    case "overview": return !!(quest.name || quest.boss || quest.difficulty || quest.enemies.length || quest.participation || quest.stamina !== undefined);
    case "hazards": return !!quest.mechanics.length;
    case "boards": return !!(quest.boards.length || questHasAxis(quest) || quest.axisNote);
    case "bombs": return !!quest.bombs.length;
    case "characters": return quest.recommendations.some(r => preview || r.confirmed);
    case "teams": return !!quest.teams.length;
    case "phases": return !!quest.phases.length;
    case "notes": return !!(quest.lastCheckedOn || quest.sources.length);
    default: return false;
  }
}
export function visibleQuestSections(article: Article, preview = false): ArticleSection[] {
  if (!article.quest) return article.sections;
  return article.sections.filter(s => questBlocksHaveContent(s.blocks) || !!s.questSection && questSectionHasData(article.quest!, s.questSection, preview));
}
export type QuestInputIssue = { key: QuestReviewKey | "notes"; message: string; severity: "error" | "warning" };
export function questInputIssues(quest: ArticleQuest): QuestInputIssue[] {
  const issues: QuestInputIssue[] = [];
  const add = (key: QuestInputIssue["key"], message: string, severity: QuestInputIssue["severity"] = "error") => issues.push({ key, message, severity });
  const has: Record<QuestReviewKey, boolean> = {
    overview: !!(quest.name.trim() && quest.boss.trim() && quest.difficulty.trim()), enemies: !!quest.enemies.length,
    gimmicks: quest.mechanics.some(m => m.category !== "ailment" && m.occurrence !== "absent"), ailments: quest.mechanics.some(m => m.category === "ailment" && m.occurrence !== "absent"),
    boards: !!quest.boards.length || questHasAxis(quest) || !!quest.axisNote, bombs: !!quest.bombs.length,
    characters: !!quest.recommendations.length, teams: !!quest.teams.length, phases: !!quest.phases.length,
  };
  for (const key of Object.keys(QUEST_REVIEW_LABELS) as QuestReviewKey[]) {
    const state = quest.review[key];
    if (state === "unconfirmed") add(key, QUEST_REVIEW_LABELS[key] + "が未確認です。", QUEST_REVIEW_REQUIRED.has(key) ? "error" : "warning");
    if (state === "confirmed" && !has[key]) add(key, QUEST_REVIEW_LABELS[key] + "を入力するか、該当なしを選んでください。");
    if (state === "none" && (has[key] || key === "overview" || key === "enemies")) add(key, QUEST_REVIEW_LABELS[key] + "の該当なしと登録内容が一致しません。");
  }
  if (!has.overview) add("overview", "クエスト名・攻略対象ボス・難易度を入力してください。");
  if (!quest.lastCheckedOn) add("notes", "最終確認日が未入力です。");
  for (const e of quest.enemies) if (!e.name.trim() || !e.attributes.some(v=>v.trim()) || !e.species.some(v=>v.trim())) add("enemies", "敵の名称・属性・種族を確認してください。");
  for (const m of quest.mechanics) {
    const key = m.category === "ailment" ? "ailments" : "gimmicks";
    if (!m.name.trim() || m.occurrence === "unknown" || m.occurrence === "present" && m.importance === "unknown") add(key, "ギミック等の名称・出現有無・対策重要度に未確認があります。");
  }
  for (const b of quest.bombs) if (!b.kind.trim() || !b.timing.trim() || !(b.condition.text.trim() || b.condition.minWordLength !== undefined || b.condition.theme.trim()) || !b.success.trim() || !b.failure.trim()) add("bombs", "ボムの種類・タイミング・解除条件・成功／失敗時の効果を確認してください。");
  for (const b of quest.boards) if (!b.label.trim() || !(b.pattern.trim() || b.image)) add("boards", "盤面名と文字配列または画像を登録してください。");
  for (const r of quest.recommendations) if (!r.characterId || !r.reason.trim() || !r.confirmed) add("characters", "適正キャラの選択・理由・管理者の確認が必要です。");
  for (const t of quest.teams) if (!t.name.trim() || !t.slots.some(Boolean)) add("teams", "編成名とキャラを登録してください。");
  for (const p of quest.phases) if (!p.name.trim() || !p.actions.trim()) add("phases", "フェーズ名と敵の行動を登録してください。");
  for (const d of quest.drops ?? []) if (d.kind === "character" ? !d.characterId : !d.name.trim()) add("overview", "ドロップ報酬のキャラ選択またはアイテム名を入力してください。");
  if (quest.dropsState === "none" && quest.drops?.length) add("overview", "ドロップ報酬の該当なしと登録内容が一致しません。");
  if ((quest.drops?.length ?? 0) > 0 && quest.dropsState !== "confirmed") add("overview", "ドロップ報酬の確認状態を確認してください。");
  for (const w of quest.waves ?? []) {
    if (!w.name.trim()) add("phases", "WAVE名を入力してください。");
    if (w.hazardsState === "none" && w.mechanicIds.length) add("phases", w.name + "のギミック等の該当なしと登録内容が一致しません。");
    if (!w.hazardsState || w.hazardsState === "unconfirmed") add("phases", w.name + "のギミック・状態異常が未確認です。", "warning");
    const layout=questWaveEnemyLayout(w,quest.enemies);
    if(!layout)add("enemies",w.name+"の敵数・配置が未確認です。","warning");
    else if(!layout.complete)add("enemies",w.name+"の敵数（1〜3体）と、各敵の選択・左／中央／右の配置を確認してください。");
  }
  return issues;
}
export function questReviewProgress(quest: ArticleQuest) {
  const values = Object.values(quest.review), reviewed = values.filter(v => v !== "unconfirmed").length;
  return { reviewed, total: values.length, percent: Math.round(reviewed / values.length * 100) };
}
function requireValue(condition: unknown, message: string): asserts condition { if (!condition) throw new Error("クエスト記事: " + message); }
const validDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/u.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
export function assertQuestArticle(article: Article, characterIds?: Set<string>) {
  if (!article.quest) {
    requireValue(!article.sections.some(s => s.questSection !== undefined || s.questWave !== undefined), "共通セクションに対応するクエスト情報がありません。");
    return;
  }
  const q = article.quest;
  const string = (v: unknown) => typeof v === "string" && v.length <= 20000;
  const strings = (v: unknown) => Array.isArray(v) && v.length <= 300 && v.every(string);
  const number = (v: unknown, min = 0, max = 999999) => v === undefined || typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
  const rows = (v: unknown) => Array.isArray(v) && v.length <= 300 && v.every(r => r && typeof r === "object" && typeof r.id === "string" && r.id.length > 0 && r.id.length <= 200) && new Set(v.map(r => r.id)).size === v.length;
  const rowStrings = (row: object, keys: string[]) => keys.every(key => string((row as Record<string, unknown>)[key]));
  requireValue(article.type === "quest_guide" && !article.event && q.version === 1, "記事タイプまたは形式が不正です。");
  requireValue(rowStrings(q, ["name", "boss", "difficulty", "category", "relatedEventArticleId", "participation", "lastCheckedOn", "axisNote"]), "基本情報は文字列で入力してください。");
  requireValue(!q.lastCheckedOn || validDate(q.lastCheckedOn), "最終確認日が不正です。");
  requireValue(number(q.stamina) && Object.hasOwn(QUEST_AXIS_LABELS, q.axis) && strings(q.sources), "体力・文字軸・出典の形式が不正です。");
  requireValue(q.axes === undefined || Array.isArray(q.axes) && q.axes.length <= Object.keys(QUEST_AXIS_OPTIONS).length && new Set(q.axes).size === q.axes.length && q.axes.every(axis => Object.hasOwn(QUEST_AXIS_OPTIONS, axis)), "文字軸は重複のない選択肢の配列で指定してください。");
  for (const url of q.sources.filter(v=>v.trim())) { try { const u = new URL(url); requireValue(u.protocol === "https:" && !u.username && !u.password && !/[\u0000-\u0020\\]/u.test(url), "出典はHTTPSのURLです。"); } catch { throw new Error("クエスト記事: 出典はHTTPSのURLです。"); } }
  requireValue(q.review && Object.keys(QUEST_REVIEW_LABELS).every(k => Object.hasOwn(QUEST_REVIEW_STATES, q.review[k as QuestReviewKey])), "入力チェックの状態が不正です。");
  for (const value of [q.enemies, q.mechanics, q.bombs, q.boards, q.phases, q.recommendations, q.teams]) requireValue(rows(value), "項目は重複のないIDを持つ配列で、300件以下です。");
  for (const e of q.enemies) requireValue(rowStrings(e, ["name", "hp", "note"]) && ["boss", "mob"].includes(e.role) && strings(e.attributes) && strings(e.species), "敵の形式が不正です。");
  for (const m of q.mechanics) requireValue(rowStrings(m, ["name", "counterTrait", "durability", "wave", "turn", "note"]) && Object.hasOwn(QUEST_MECHANIC_CATEGORIES, m.category) && Object.hasOwn(QUEST_IMPORTANCE, m.importance) && Object.hasOwn(QUEST_OCCURRENCE, m.occurrence) && strings(m.counterTags) && number(m.count), "ギミック等の形式が不正です。");
  for (const b of q.bombs) requireValue(rowStrings(b, ["kind", "timing", "success", "failure", "method"]) && number(b.turnLimit, 1) && b.condition && rowStrings(b.condition, ["theme", "text"]) && number(b.condition.minWordLength, 1, 99) && number(b.condition.requiredCount, 1), "ボム条件の形式または数値が不正です。");
  for (const b of q.boards) requireValue(rowStrings(b, ["label", "pattern", "wave", "turn", "phase", "behavior"]) && strings(b.words), "盤面の形式が不正です。");
  for (const p of q.phases) requireValue(rowStrings(p, ["name", "wave", "turn", "trigger", "actions", "response"]) && strings(p.mechanicIds) && p.mechanicIds.every(id => q.mechanics.some(m => m.id === id)) && number(p.turnLimit, 1), "フェーズの形式・関連ギミック・数値が不正です。");
  const validCharacter = (id: unknown) => typeof id === "string" && (!id || !characterIds || characterIds.has(id));
  requireValue(q.bossCharacterId === undefined || validCharacter(q.bossCharacterId), "ボスのキャラIDが不正です。");
  requireValue(q.dropsState === undefined || Object.hasOwn(QUEST_REVIEW_STATES, q.dropsState), "報酬の確認状態が不正です。");
  requireValue(q.drops === undefined || rows(q.drops), "報酬は重複のないIDを持つ配列です。");
  for (const d of q.drops ?? []) requireValue(rowStrings(d, ["name", "condition", "characterId"]) && ["character", "item"].includes(d.kind) && validCharacter(d.characterId), "報酬の形式・キャラIDが不正です。");
  requireValue(q.waves === undefined || rows(q.waves), "WAVEは重複のないIDを持つ配列です。");
  for (const w of q.waves ?? []) {
    requireValue(string(w.name) && (w.hazardsState === undefined || Object.hasOwn(QUEST_REVIEW_STATES, w.hazardsState)), "WAVE名・確認状態が不正です。");
    requireValue(w.enemyCount === undefined || typeof w.enemyCount === "number" && [1,2,3].includes(w.enemyCount), "WAVEの敵数は1〜3体です。");
    requireValue(w.enemyPlacements === undefined || Array.isArray(w.enemyPlacements) && w.enemyPlacements.length <= 3 && w.enemyPlacements.every(p => p && typeof p === "object" && string(p.enemyId) && (!p.enemyId || q.enemies.some(e => e.id === p.enemyId)) && (p.position === "unknown" || Object.hasOwn(QUEST_ENEMY_POSITIONS,p.position))), "敵の配置・参照の形式が不正です。");
    const positions=w.enemyPlacements?.filter(p=>p.position!=="unknown").map(p=>p.position)??[];
    requireValue(new Set(positions).size===positions.length,"同じWAVEの敵の配置が重複しています。");
    for (const [key, source] of [["mechanicIds", q.mechanics], ["boardIds", q.boards], ["bombIds", q.bombs], ["phaseIds", q.phases]] as const) requireValue(strings(w[key]) && new Set(w[key]).size === w[key].length && w[key].every(id => source.some(row => row.id === id)), "WAVEに不正な参照があります。");
  }
  const waveSections = article.sections.filter(s => s.questWave !== undefined);
  requireValue(waveSections.every(s => s.questWave && q.waves?.some(w => w.id === s.questWave!.id) && ["points", "notes"].includes(s.questWave.target) && !s.questSection), "WAVE解説の参照が不正です。");
  for (const w of q.waves ?? []) for (const target of ["points", "notes"]) requireValue(waveSections.filter(s => s.questWave?.id === w.id && s.questWave.target === target).length === 1, "WAVEの攻略ポイント・注意点の構造が不足または重複しています。");
  for (const b of q.boards) requireValue(b.display === undefined || ["both", "image", "pattern"].includes(b.display), "盤面の表示方法が不正です。");
  for (const r of q.recommendations) requireValue(rowStrings(r, ["characterId", "reason"]) && validCharacter(r.characterId) && ["leader", "sub"].includes(r.role) && typeof r.confirmed === "boolean", "適正キャラに未登録ID、または不正な形式があります。");
  for (const t of q.teams) requireValue(rowStrings(t, ["name", "note"]) && Array.isArray(t.slots) && t.slots.length === 12 && t.slots.every(id => id === null || typeof id === "string" && !!id && validCharacter(id)), "編成は12枠で、登録済みキャラIDか空欄です。");
  const keys = article.sections.filter(s => s.questSection !== undefined).map(s => s.questSection!);
  requireValue(keys.length === Object.keys(QUEST_SECTIONS).length && new Set(keys).size === keys.length && keys.every(key => Object.hasOwn(QUEST_SECTIONS, key)), "共通セクションの構造が不足または重複しています。");
  if (article.status === "published") {
    requireValue(article.contentReviewed === true, "公開前プレビューを確認してください。");
    const errors = questInputIssues(q).filter(i => i.severity === "error");
    requireValue(!errors.length, "公開前の入力チェック: " + errors.map(i => i.message).join(" / "));
  }
}
export function isQuestPublicationReady(article: Article): boolean {
  try { assertQuestArticle(article); return true; } catch { return false; }
}
