const GIMMICK_DISPLAY_NAMES = [
  "シールド",
  "トゲ",
  "チェンジ",
  "弱体",
  "ウォール",
  "ビリビリ",
  "ヒール",
  "コピー",
  "地雷",
  "フリーズ",
  "バルーン",
  "スマッシュ",
  "レーザー",
] as const;

export const GIMMICK_OPTIONS = [...GIMMICK_DISPLAY_NAMES];
export const SUPER_GIMMICK_OPTIONS = GIMMICK_DISPLAY_NAMES.map((name) => `スーパー${name}`);
export const COMBINED_GIMMICK_OPTIONS = GIMMICK_DISPLAY_NAMES.flatMap((name) => [name, `S${name}`]);

function compact(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, "");
}

export function normalizeGimmickName(value: string) {
  const normalized = compact(value)
    .replace(/^S(?=バルーン|ビリビリ|トゲ|チェンジ|コピー|シールド|スマッシュ|ヒール|フリーズ|ウォール|弱体|地雷|レーザー)/, "")
    .replace(/スーパーのみ/g, "")
    .replace(/ガード/g, "")
    .replace(/ブレイカー/g, "")
    .replace(/耐性/g, "");

  for (const gimmick of GIMMICK_DISPLAY_NAMES) {
    if (normalized.includes(gimmick)) {
      return gimmick;
    }
  }
  return value.trim();
}

export function normalizeSuperGimmickName(value: string) {
  const compacted = compact(value)
    .replace(/ガード/g, "")
    .replace(/ブレイカー/g, "")
    .replace(/耐性/g, "");
  const isSuper = compacted.includes("スーパー") || /^S(?=バルーン|ビリビリ|トゲ|チェンジ|コピー|シールド|スマッシュ|ヒール|フリーズ|ウォール|弱体|地雷|レーザー)/.test(compacted);
  if (!isSuper) {
    return "";
  }
  const normalized = compacted.replace(/^S/, "").replace(/スーパー/g, "");
  for (const gimmick of GIMMICK_DISPLAY_NAMES) {
    if (normalized.includes(gimmick)) {
      return `スーパー${gimmick}`;
    }
  }
  return value.trim();
}

export function superGimmickDisplayName(value: string) {
  const normalized = normalizeSuperGimmickName(value);
  if (!normalized) {
    return value.trim();
  }
  return normalized.replace(/^スーパー/, "S");
}

export function superGimmickValueFromDisplay(value: string) {
  const compacted = compact(value);
  if (compacted.startsWith("S")) {
    return normalizeSuperGimmickName(`スーパー${compacted.slice(1)}`);
  }
  return normalizeSuperGimmickName(compacted);
}

export function isSuperGimmickDisplayName(value: string) {
  return Boolean(superGimmickValueFromDisplay(value));
}

export function combinedGimmickDisplayList(gimmicks: string[] = [], superGimmicks: string[] = []) {
  const normalSet = new Set(normalizeGimmickList(gimmicks));
  const superSet = new Set(normalizeSuperGimmickList(superGimmicks).map(superGimmickDisplayName));
  const ordered: string[] = [];
  for (const gimmick of GIMMICK_DISPLAY_NAMES) {
    if (normalSet.has(gimmick)) {
      ordered.push(gimmick);
    }
    const superName = `S${gimmick}`;
    if (superSet.has(superName)) {
      ordered.push(superName);
    }
  }
  return ordered;
}

export function normalizeGimmickList(values: string[] = []) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeGimmickName(String(value ?? "")))
        .filter(Boolean),
    ),
  );
}

export function normalizeSuperGimmickList(values: string[] = []) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeSuperGimmickName(String(value ?? "")))
        .filter(Boolean),
    ),
  );
}
