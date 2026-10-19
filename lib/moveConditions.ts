import type { CharacterKotowaza, CharacterMove, MoveCondition } from "./types";

export function normalizeMoveCondition(value: unknown): MoveCondition | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as {
    type?: unknown;
    comboCount?: unknown;
    theme?: unknown;
    count?: unknown;
  };
  const type = String(record.type ?? "");
  if (type === "combo") {
    const comboCount = Number(record.comboCount);
    return Number.isFinite(comboCount) && comboCount > 0
      ? { type: "combo", comboCount: Math.floor(comboCount) }
      : null;
  }
  if (type === "theme") {
    const theme = String(record.theme ?? "").trim();
    return theme ? { type: "theme", theme } : null;
  }
  if (type === "minLetters") {
    const count = Number(record.count);
    return count === 4 || count === 5 || count === 6 ? { type: "minLetters", count } : null;
  }
  if (type === "startsWithOwnLetter4") {
    return { type: "startsWithOwnLetter4" };
  }
  if (type === "endsWithOwnLetter4") {
    return { type: "endsWithOwnLetter4" };
  }
  return null;
}

export function normalizeMoveConditions(value: unknown): MoveCondition[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(normalizeMoveCondition)
    .filter((item): item is MoveCondition => Boolean(item));
}

export function normalizeMove(value: unknown): CharacterMove | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const move = value as CharacterMove;
  const condition = String(move.condition ?? "").trim();
  const conditions = normalizeMoveConditions(move.conditions);
  const effect = String(move.effect ?? "").trim();
  return condition || conditions.length || effect ? { condition, conditions, effect } : undefined;
}

export function normalizeKotowaza(value: unknown): CharacterKotowaza[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const entries: CharacterKotowaza[] = [];
  for (const item of value) {
      const record = item as Partial<CharacterKotowaza>;
      const level = Number(record.level);
      if (![0, 1, 2, 3, 4].includes(level)) {
        continue;
      }
      const condition = String(record.condition ?? "").trim();
      const conditions = normalizeMoveConditions(record.conditions);
      const effect = String(record.effect ?? "").trim();
      if (!condition && !conditions.length && !effect) {
        continue;
      }
      entries.push({
        level: level as 0 | 1 | 2 | 3 | 4,
        condition,
        conditions,
        effect,
      });
  }
  return entries.sort((a, b) => a.level - b.level);
}

export function formatMoveCondition(condition: MoveCondition) {
  if (condition.type === "combo") {
    return `${condition.comboCount}コンボで発動`;
  }
  if (condition.type === "theme") {
    return `テーマ「${condition.theme}」のことばで発動`;
  }
  if (condition.type === "minLetters") {
    return `${condition.count}文字以上`;
  }
  if (condition.type === "startsWithOwnLetter4") {
    return "自身の文字から始まる4文字";
  }
  return "自身の文字で終わる4文字";
}

export function moveConditionSearchText(move?: CharacterMove) {
  if (!move) {
    return "";
  }
  return [
    move.condition ?? "",
    ...(move.conditions ?? []).map(formatMoveCondition),
    move.effect ?? "",
  ].join(" ");
}

export function kotowazaSearchText(kotowaza?: CharacterKotowaza[]) {
  return (kotowaza ?? [])
    .map((item) => [item.condition ?? "", ...(item.conditions ?? []).map(formatMoveCondition), item.effect ?? ""].join(" "))
    .join(" ");
}

function cleanDisplayCondition(value: string) {
  let text = value.trim().replace(/^条件\s*[:：]\s*/, "").replace(/^[・●•\s]+/, "").trim();
  if (text.startsWith("【") && text.endsWith("】")) {
    let depth = 0;
    let enclosesWholeText = true;
    for (let index = 0; index < text.length; index += 1) {
      if (text[index] === "【") depth += 1;
      if (text[index] === "】") depth -= 1;
      if (depth === 0 && index < text.length - 1) enclosesWholeText = false;
    }
    if (enclosesWholeText && depth === 0) text = text.slice(1, -1).trim();
  }
  return text;
}

/** Format legacy line breaks as alternatives without adding a second source OR. Effects are untouched. */
export function displayMoveConditions(conditions: MoveCondition[] = [], legacyCondition?: string) {
  const legacy = cleanDisplayCondition(legacyCondition ?? "");
  const lines = legacy.replace(/\r\n?/g, "\n").split("\n").map(line => line.trim()).filter(Boolean);
  const alternatives = lines.length > 1 ? lines.map(line => line.replace(/^or(?:\s+|$)/i, "").replace(/(?:\s+|^)or$/i, "").trim()).filter(Boolean) : lines;
  return [...new Set([...alternatives, ...conditions.map(formatMoveCondition)].map(cleanDisplayCondition).filter(Boolean))];
}
