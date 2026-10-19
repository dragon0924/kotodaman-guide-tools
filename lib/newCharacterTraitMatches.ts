import type { CharacterRecord, TraitTemplate } from "./types";
export type SupplementalTraitMatch = {
  characterId: string; characterName: string; sourceType: "trait" | "blessingTrait";
  rawText: string; matchedTemplateId: string; matchedTemplateName: string;
  confidence: "high"; status: "matched";
};
export type SupplementalTraitFile = {meta: {characterIds: string[]}; matches: SupplementalTraitMatch[]};
export type TraitMatchIndex = Map<string, {ids: string[]; names: string[]}>;
/** Supplements only the named new IDs, and invalidates a match when its source text changes. */
export function supplementTraitMatchIndex(index: TraitMatchIndex, file: SupplementalTraitFile | null, characters: CharacterRecord[], templates: TraitTemplate[]) {
  if (!file) return index;
  const allowed = new Set(file.meta.characterIds);
  const byId = new Map(characters.map(c=>[c.id,c]));
  const byTemplate = new Map(templates.map(t=>[t.id,t]));
  const result: TraitMatchIndex = new Map([...index].map(([id,entry])=>[id,{ids:[...entry.ids],names:[...entry.names]}]));
  for (const match of file.matches) {
    const character = byId.get(match.characterId);const template=byTemplate.get(match.matchedTemplateId);
    const raw = match.sourceType === "trait" ? character?.traitsRaw : match.sourceType === "blessingTrait" ? character?.blessingTraitsRaw : undefined;
    if (!allowed.has(match.characterId) || match.status !== "matched" || match.confidence !== "high" || !character || character.name !== match.characterName || !template || template.isActive === false || template.sourceType !== match.sourceType || !raw?.some(line=>line.trim()===match.rawText.trim())) continue;
    const entry = result.get(character.id) ?? {ids:[],names:[]};
    entry.ids=[...new Set([...entry.ids,template.id])];entry.names=[...new Set([...entry.names,template.name])];result.set(character.id,entry);
  }
  return result;
}
