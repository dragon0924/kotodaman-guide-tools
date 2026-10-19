import type { CharacterRarityType } from "./types";

export const SPECIAL_RARITY_TYPES = ["スペシャル", "レジェンド", "グランド", "ドリーム", "ミラクル"] as const;

export function normalizeRarityType(value: unknown): CharacterRarityType {
  const text = String(value ?? "").trim();
  return SPECIAL_RARITY_TYPES.includes(text as Exclude<CharacterRarityType, "">)
    ? (text as CharacterRarityType)
    : "";
}

export function rarityClass(rarity?: string) {
  if (rarity === "スペシャル") return "rarity-special";
  if (rarity === "レジェンド") return "rarity-legend";
  if (rarity === "グランド") return "rarity-grand";
  if (rarity === "ドリーム") return "rarity-dream";
  if (rarity === "ミラクル") return "rarity-miracle";
  return "";
}

export function sortRarityTypes(values: string[]) {
  const order = new Map(SPECIAL_RARITY_TYPES.map((rarity, index) => [rarity, index]));
  return [...values].sort((a, b) => (order.get(a as never) ?? 999) - (order.get(b as never) ?? 999) || a.localeCompare(b, "ja"));
}
