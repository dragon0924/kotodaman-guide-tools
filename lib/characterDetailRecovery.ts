import type { CharacterMove, CharacterRecord } from "./types";

export const RECOVERY_FIELDS = ["leaderTraitText", "normalMove", "superMove", "traitsRaw", "blessingTraitsRaw"] as const;
export type RecoveryField = typeof RECOVERY_FIELDS[number];
export type CharacterDetailRecovery = {
  characterId: string;
  characterName: string;
  sourceCharacterName: string;
  sourceUrl: string;
  checkedAt: string;
  sourceSha256: string;
  fields: Partial<Pick<CharacterRecord, RecoveryField>>;
  sectionHeadings: Partial<Record<RecoveryField, string>>;
};

const text = (value: unknown): value is string => typeof value === "string" && !!value.trim();
const body = (values: unknown): values is string[] => Array.isArray(values) && values.some(value => text(value) && !/^(?:なし|効果(?:[（(].*[）)])?)$/u.test(value.trim()));
const move = (value: unknown) => !!value && typeof value === "object" && text((value as CharacterMove).effect);

export function parseCharacterDetailRecoveries(value: unknown): CharacterDetailRecovery[] {
  const file = value as { version?: unknown; entries?: CharacterDetailRecovery[] } | null;
  if (file?.version !== 1 || !Array.isArray(file.entries)) throw new Error("Invalid character detail recovery file");
  const ids = new Set<string>();
  for (const entry of file.entries) {
    if (!entry || ![entry.characterId, entry.characterName, entry.sourceCharacterName, entry.sourceUrl, entry.checkedAt].every(text)
      || !Number.isFinite(Date.parse(entry.checkedAt)) || !/^[a-f0-9]{64}$/.test(entry.sourceSha256 ?? "") || ids.has(entry.characterId)
      || !entry.fields || typeof entry.fields !== "object" || !entry.sectionHeadings || !Object.keys(entry.fields).length) throw new Error("Invalid or duplicate character detail recovery");
    const source = new URL(entry.sourceUrl);
    if (source.protocol !== "https:" || source.hostname !== "gamewith.jp" || !/^\/kotodaman\/article\/show\/\d+$/.test(source.pathname) || source.search || source.hash) throw new Error("Unsupported recovery source");
    for (const key of Object.keys(entry.fields)) {
      if (!RECOVERY_FIELDS.includes(key as RecoveryField)) throw new Error(`Unsupported recovery field: ${key}`);
      const field = key as RecoveryField;
      const valid = field.endsWith("Move") ? move(entry.fields[field]) : field.endsWith("Raw") ? body(entry.fields[field]) && (entry.fields[field] as string[]).every(text) : text(entry.fields[field]);
      const suffix = field === "traitsRaw" ? "の特性" : field === "blessingTraitsRaw" ? "の祝福特性" : field === "leaderTraitText" ? "のリーダー特性" : "のわざ・すごわざ";
      if (!valid || entry.sectionHeadings[field] !== entry.sourceCharacterName + suffix) throw new Error(`Unverified recovery section: ${entry.characterName}/${field}`);
    }
    ids.add(entry.characterId);
  }
  return file.entries;
}

/** Explicit manual removals stay authoritative; a missing move component may be filled. */
function manualBlocks(manual: Partial<CharacterRecord> | undefined, field: RecoveryField) {
  if (!manual || !Object.hasOwn(manual, field)) return false;
  const value = manual[field];
  return value == null || typeof value === "string" && !value.trim() || Array.isArray(value) && !body(value);
}

export function applyCharacterDetailRecoveries<T extends Partial<CharacterRecord>>(characters: T[], entries: CharacterDetailRecovery[], manualCharacters: Partial<CharacterRecord>[] = []) {
  const byId = new Map(entries.map(entry => [entry.characterId, entry]));
  const manualById = new Map(manualCharacters.map(character => [character.id, character]));
  const applied: Array<{ characterId: string; fields: RecoveryField[] }> = [];
  const result = characters.map(character => {
    const entry = character.id ? byId.get(character.id) : undefined;
    if (!entry || entry.characterName !== character.name || entry.sourceUrl !== character.sourceUrl) return character;
    const manual = manualById.get(character.id);
    const next = { ...character };
    const fields: RecoveryField[] = [];
    for (const field of RECOVERY_FIELDS) {
      const incoming = entry.fields[field];
      if (incoming === undefined || manualBlocks(manual, field)) continue;
      if (field === "normalMove" || field === "superMove") {
        const current = character[field];
        // Never replace an existing effect, including its conditions or structured rules.
        if (move(current)) continue;
        const explicitEffect = manual?.[field];
        if (explicitEffect && Object.hasOwn(explicitEffect, "effect") && !text(explicitEffect.effect)) continue;
        const recovered = incoming as CharacterMove;
        next[field] = { ...recovered, ...current, effect: recovered.effect };
      } else if (field === "traitsRaw" || field === "blessingTraitsRaw") {
        if (body(character[field])) continue;
        next[field] = [...incoming as string[]];
      } else {
        if (text(character[field])) continue;
        next[field] = incoming as string;
      }
      fields.push(field);
    }
    if (!fields.length) return character;
    applied.push({ characterId: character.id!, fields });
    return next;
  });
  return { characters: result, applied };
}
