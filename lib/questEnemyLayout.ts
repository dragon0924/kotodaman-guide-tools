import type { QuestArticleEnemy, QuestArticleWave, QuestEnemyPosition, QuestWaveEnemyPlacement } from "./types";

export const QUEST_ENEMY_POSITIONS: Record<QuestEnemyPosition, string> = { left: "左", center: "中央", right: "右" };
export const questEnemyPositionText = (position: QuestWaveEnemyPlacement["position"]) => position === "unknown" ? "配置未確認" : QUEST_ENEMY_POSITIONS[position];
export function questWaveEnemyLayout(wave: QuestArticleWave, enemies: QuestArticleEnemy[]) {
  if (wave.enemyCount === undefined && wave.enemyPlacements === undefined) return undefined;
  const placements = wave.enemyPlacements ?? [];
  const resolve = (placement: QuestWaveEnemyPlacement) => ({ ...placement, enemy: enemies.find(e => e.id === placement.enemyId) });
  const complete = wave.enemyCount !== undefined && placements.length === wave.enemyCount && placements.every(p => p.position !== "unknown" && enemies.some(e => e.id === p.enemyId)) && new Set(placements.map(p => p.position)).size === placements.length;
  return { count: wave.enemyCount, complete,
    positions: (Object.keys(QUEST_ENEMY_POSITIONS) as QuestEnemyPosition[]).map(position => ({ position, placement: placements.find(p => p.position === position) ? resolve(placements.find(p => p.position === position)!) : undefined })),
    unplaced: placements.filter(p => p.position === "unknown").map(resolve),
  };
}
// Reducing a populated layout requires an explicit UI decision. Empty slots can shrink directly.
export function planQuestEnemyCount(wave: QuestArticleWave, count: QuestArticleWave["enemyCount"]) {
  const previous = wave.enemyPlacements ?? [];
  const removed = count === undefined ? [] : previous.slice(count).filter(p => p.enemyId || p.position !== "unknown");
  const enemyPlacements = count === undefined ? previous : Array.from({ length: count }, (_, index): QuestWaveEnemyPlacement => previous[index] ?? { enemyId: "", position: "unknown" });
  return { removed, patch: { enemyCount: count, enemyPlacements } };
}
export function clearMissingQuestEnemyReferences(waves: QuestArticleWave[], enemies: QuestArticleEnemy[]) {
  return waves.map(w => w.enemyPlacements === undefined ? w : { ...w, enemyPlacements: w.enemyPlacements.map(p => enemies.some(e => e.id === p.enemyId) ? p : { ...p, enemyId: "" }) });
}
