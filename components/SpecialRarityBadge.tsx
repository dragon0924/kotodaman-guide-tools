import { rarityClass } from "@/lib/rarity";
import type { CharacterRarityType } from "@/lib/types";

export function SpecialRarityBadge({
  compact = false,
  rarity,
}: {
  compact?: boolean;
  rarity?: CharacterRarityType | string;
}) {
  if (!rarity) {
    return null;
  }
  return (
    <span className={`rarity-badge ${compact ? "compact" : ""} ${rarityClass(rarity)}`}>
      {rarity}
    </span>
  );
}
