import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { QuestCharacterRecommendation, QuestFile, QuestRecord } from "./types";

export const QUESTS_PATH = path.join(process.cwd(), "data", "quests.json");

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))]
    : [];
}

function normalizeRecommendations(value: unknown): QuestCharacterRecommendation[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const recommendations: Array<QuestCharacterRecommendation | null> = value
    .map((item) => {
      const raw = item && typeof item === "object" ? item as Partial<QuestCharacterRecommendation> : {};
      const characterId = String(raw.characterId ?? "").trim();
      if (!characterId) {
        return null;
      }
      return {
        characterId,
        role: String(raw.role ?? "").trim() || undefined,
        memo: String(raw.memo ?? "").trim() || undefined,
      };
    });
  return recommendations.filter((item): item is QuestCharacterRecommendation => Boolean(item));
}

function normalizeQuest(value: Partial<QuestRecord>): QuestRecord | null {
  const questId = String(value.questId ?? value.id ?? "").trim();
  const questName = String(value.questName ?? value.name ?? "").trim();
  if (!questId || !questName) {
    return null;
  }
  const type = String(value.type ?? value.questType ?? "").trim() || "降臨";
  const difficulties = normalizeStringArray(value.difficulties);
  const legacyDifficulty = String(value.difficulty ?? "").trim();
  const enemyAttributes = normalizeStringArray(value.enemyAttributes);
  const legacyEnemyAttribute = String(value.enemyAttribute ?? "").trim();
  return {
    questId,
    questName,
    id: questId,
    name: questName,
    type,
    questType: type,
    enemyAttribute: legacyEnemyAttribute || enemyAttributes[0] || undefined,
    enemyAttributes: enemyAttributes.length ? enemyAttributes : legacyEnemyAttribute ? [legacyEnemyAttribute] : [],
    difficulty: legacyDifficulty || difficulties[0] || undefined,
    difficulties: difficulties.length ? difficulties : legacyDifficulty ? [legacyDifficulty] : [],
    statusAilments: normalizeStringArray(value.statusAilments),
    gimmicks: normalizeStringArray(value.gimmicks),
    hazards: normalizeStringArray(value.hazards),
    obtainableCharacterIds: normalizeStringArray(value.obtainableCharacterIds),
    clearRewards: normalizeStringArray(value.clearRewards),
    bestLeaderIds: normalizeStringArray(value.bestLeaderIds),
    recommendedLeaderIds: normalizeStringArray(value.recommendedLeaderIds),
    bestSubCharacters: normalizeRecommendations(value.bestSubCharacters),
    recommendedSubCharacters: normalizeRecommendations(value.recommendedSubCharacters),
    boardPatterns: normalizeStringArray(value.boardPatterns),
    strategyText: String(value.strategyText ?? "").trim() || undefined,
    sourceUrl: String(value.sourceUrl ?? "").trim() || undefined,
    memo: String(value.memo ?? "").trim() || undefined,
    updatedAt: String(value.updatedAt ?? "").trim() || undefined,
  };
}

export function normalizeQuestFile(value: unknown): QuestFile {
  const raw = value && typeof value === "object" ? value as QuestFile : { quests: [] };
  return {
    meta: raw.meta ?? {},
    quests: Array.isArray(raw.quests)
      ? raw.quests.map((quest) => normalizeQuest(quest)).filter((quest): quest is QuestRecord => Boolean(quest))
      : [],
  };
}

export async function readQuests(): Promise<QuestFile> {
  try {
    const payload = await readFile(QUESTS_PATH, "utf8");
    return normalizeQuestFile(JSON.parse(payload));
  } catch {
    return {
      meta: { updatedAt: null },
      quests: [],
    };
  }
}

export async function writeQuests(file: QuestFile) {
  const normalized = normalizeQuestFile({
    ...file,
    meta: {
      ...(file.meta ?? {}),
      updatedAt: new Date().toISOString(),
    },
  });
  await mkdir(path.dirname(QUESTS_PATH), { recursive: true });
  await writeFile(QUESTS_PATH, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}
