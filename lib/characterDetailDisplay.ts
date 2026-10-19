import type { CharacterRecord, CharacterStatus, TraitTemplate } from "./types";
import { renderTrait } from "./traits.ts";

const NO_TRAIT = /^(?:効果(?:[（(]最大強化時[）)])?|なし|(?:EX)?祝福(?:特性|とくせい)(?:なし)?)$/u;
export function explicitlyNoTraits(values: string[] = []) {
  const lines = values.flatMap(value => value.split(/\r?\n/u)).map(line => line.trim()).filter(Boolean);
  return lines.some(line => /^(?:なし|(?:特性|とくせい)なし)$/u.test(line))
    && lines.every(line => /^(?:効果|なし|(?:特性|とくせい)なし)$/u.test(line));
}
export function meaningfulTraitLines(values: string[] = []) {
  return [...new Set(values.flatMap(value => value.split(/\r?\n/u)).map(line => line.trim()).filter(line => line && !NO_TRAIT.test(line)))];
}
export function partitionDisplayTraits(character: CharacterRecord, templates: TraitTemplate[]) {
  const normal: string[] = []; const blessing: string[] = [];
  for (const trait of character.traits ?? []) {
    const template = typeof trait === "string" ? undefined : templates.find(t => t.id === trait.templateId);
    (template?.sourceType === "blessingTrait" ? blessing : normal).push(renderTrait(trait, templates));
  }
  return {renderedTraits: meaningfulTraitLines([...normal, ...(character.traitsRaw ?? [])]), renderedBlessingTraits: meaningfulTraitLines([...blessing, ...(character.blessingTraitsRaw ?? [])])};
}
export function leaderInformationState(character: Pick<CharacterRecord,"leaderTraits"|"leaderTraitText">) {
  if (character.leaderTraits?.length) return "classified";
  return character.leaderTraitText?.trim() ? "text_only" : "missing";
}
export function statusDisplayEntries(status?: CharacterStatus) {
  if (!status) return [];
  const total = status.raw?.some(line => line.includes("合計"));
  const labels = {hp:"HP",atk:"ATK",maxHp:total ? "HP（合計）" : "最大HP",maxAtk:total ? "ATK（合計）" : "最大ATK",blessedHp:"HP（祝福）",blessedAtk:"ATK（祝福）"};
  return (Object.keys(labels) as Array<keyof typeof labels>).flatMap(key => {
    const value=status[key];
    return typeof value === "number" && Number.isFinite(value) ? [{key,label:labels[key],value}] : [];
  });
}
