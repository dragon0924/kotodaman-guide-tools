import { createHash } from "node:crypto";
import type { CharacterRecord, CharacterDetailCandidate } from "./types";

export function characterSourceKey(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "gamewith.jp" || !/^\/kotodaman\/article\/show\/\d+\/?$/.test(url.pathname)) {
    throw new Error(`Unsupported character source: ${value}`);
  }
  return `${url.origin}${url.pathname.replace(/\/$/, "")}`;
}

export type NewCharacterEntry = {
  character: CharacterRecord;
  candidate: CharacterDetailCandidate;
  evidence: {
    sourceUrls: string[];
    kotowazaCoverage?: "full_0_to_4" | "partial" | "max_only" | "none";
    unresolved: string[];
    identityNote?: string;
  };
};

export function appendNewCharacters(existing: CharacterRecord[], manual: Partial<CharacterRecord>[], entries: NewCharacterEntry[]) {
  const ids = new Set<string>();
  const sources = new Set<string>();
  for (const c of existing) {
    if (!c.id || ids.has(c.id)) throw new Error(`Duplicate or empty existing ID: ${c.id}`);
    ids.add(c.id);
    if (c.sourceUrl) sources.add(characterSourceKey(c.sourceUrl));
  }
  for (const c of manual) {
    if (c.id) ids.add(c.id);
    if (c.sourceUrl) sources.add(characterSourceKey(c.sourceUrl));
  }
  const incomingIds = new Set<string>();
  const incomingSources = new Set<string>();
  const added: NewCharacterEntry[] = [];
  const skipped: string[] = [];
  for (const entry of entries) {
    const c = entry.character;
    const key = characterSourceKey(c.sourceUrl);
    if (incomingIds.has(c.id) || incomingSources.has(key)) throw new Error(`Duplicate incoming identity: ${c.name}`);
    incomingIds.add(c.id); incomingSources.add(key);
    if (sources.has(key)) { skipped.push(c.name); continue; }
    if (ids.has(c.id)) throw new Error(`ID collision: ${c.name}`);
    const expectedId = createHash("sha1").update(`${c.sourceUrl}::${c.name}`).digest("hex").slice(0, 24);
    if (!c.name?.trim() || c.id !== expectedId || !c.letters?.length || !c.imageUrl || !c.species || c.species === "不明" || !c.normalMove?.effect || !c.superMove?.effect) {
      throw new Error(`Incomplete new character: ${c.name}`);
    }
    if (entry.candidate.characterId !== c.id || entry.candidate.name !== c.name || entry.candidate.sourceUrl !== c.sourceUrl) throw new Error(`Candidate identity mismatch: ${c.name}`);
    if (!entry.evidence.sourceUrls.includes(c.sourceUrl)) throw new Error(`Missing source evidence: ${c.name}`);
    if (c.kotowaza?.length) {
      const levels = c.kotowaza.map(k => k.level);
      if (new Set(levels).size !== levels.length || levels.some(l => ![0,1,2,3,4].includes(l)) || c.kotowaza.some(k => !k.condition?.trim() || !k.effect?.trim())) throw new Error(`Invalid kotowaza: ${c.name}`);
      const coverage = entry.evidence.kotowazaCoverage;
      if (!coverage || coverage === "none" || (coverage === "full_0_to_4" && !([0,1,2,3,4] as const).every(l => levels.includes(l))) || (coverage === "max_only" && (levels.length !== 1 || levels[0] !== 4))) throw new Error(`Invalid kotowaza coverage: ${c.name}`);
    }
    const mappings = c.letterAttributes ?? [];
    if (c.letters.some(letter => !mappings.some(m => m.letter === letter && m.attributes.length))) throw new Error(`Incomplete letter attributes: ${c.name}`);
    added.push(entry); ids.add(c.id); sources.add(key);
  }
  const characters = [...existing, ...added.map(e => e.character)];
  const validIds = new Set([...characters, ...manual].map(c => c.id));
  for (const {character} of added) for (const id of character.relatedCharacterIds ?? []) {
    if (!validIds.has(id)) throw new Error(`Unknown related character: ${character.name} -> ${id}`);
  }
  return { characters, added, skipped };
}
