import type { Article, ArticleQuest, ArticleSection, QuestArticleWave } from "./types";

export type QuestWaveView = QuestArticleWave & { derived?: boolean };
export const WAVE_BODY_LABELS = { points: "攻略ポイント", notes: "注意点・特殊条件" };
export function questWaveBody(article: Article, id: string, target: "points" | "notes") {
  return article.sections.find(s => s.questWave?.id === id && s.questWave.target === target);
}
// Wave names/order/references live in quest.waves; rich blocks remain in the existing article sections.
export function syncQuestWaveSections(sections: ArticleSection[], waves: QuestArticleWave[], makeId: () => string): ArticleSection[] {
  return [...sections.filter(s => !s.questWave), ...waves.flatMap(w => (["points", "notes"] as const).map(target => {
    const existing = sections.find(s => s.questWave?.id === w.id && s.questWave.target === target);
    return { ...(existing ?? { id: makeId(), blocks: [{ id: makeId(), type: "paragraph" as const, content: "" }] }), heading: w.name + " · " + WAVE_BODY_LABELS[target], questWave: { id: w.id, target } };
  }))];
}
export function questWaves(q: ArticleQuest): QuestWaveView[] {
  if (q.waves?.length) return q.waves;
  // Only an unambiguous legacy WAVE number is grouped. Free timing prose is never parsed into a wave.
  const key = (value: string) => value.trim().match(/^(?:WAVE\s*)?([1-9]\d*)$/iu)?.[1];
  const values = [...new Set([...q.phases, ...q.boards, ...q.mechanics].map(row => key(row.wave)).filter((v): v is string => !!v))];
  return values.map(value => ({ id: "legacy-" + value, name: "WAVE " + value, derived: true,
    mechanicIds: q.mechanics.filter(m => key(m.wave) === value).map(m => m.id), boardIds: q.boards.filter(b => key(b.wave) === value).map(b => b.id),
    phaseIds: q.phases.filter(p => key(p.wave) === value).map(p => p.id), bombIds: [] }));
}
export function questWaveData(q: ArticleQuest, w: QuestArticleWave): ArticleQuest {
  return { ...q, mechanics: q.mechanics.filter(m => w.mechanicIds.includes(m.id)), boards: q.boards.filter(b => w.boardIds.includes(b.id)), bombs: q.bombs.filter(b => w.bombIds.includes(b.id)), phases: q.phases.filter(p => w.phaseIds.includes(p.id)) };
}
export function questUnassignedData(q: ArticleQuest, waves: QuestArticleWave[]): ArticleQuest {
  const used = (key: "mechanicIds" | "boardIds" | "bombIds" | "phaseIds", id: string) => waves.some(w => w[key].includes(id));
  return { ...q, mechanics: q.mechanics.filter(m => !used("mechanicIds", m.id)), boards: q.boards.filter(b => !used("boardIds", b.id)), bombs: q.bombs.filter(b => !used("bombIds", b.id)), phases: q.phases.filter(p => !used("phaseIds", p.id)) };
}
