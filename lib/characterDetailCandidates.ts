import type {
  CharacterDetailCandidate,
  CharacterLetter,
  CharacterMove,
  CharacterRecord,
  CharacterSkill,
} from "./types";

export type DetailField =
  | "leaderTraitText"
  | "normalMove"
  | "superMove"
  | "traitsRaw"
  | "blessingTraitsRaw"
  | "status"
  | "exSkill"
  | "chargeSkill"
  | "missingLetters";

export type ManualCharacterRecord = Partial<CharacterRecord> & Pick<CharacterRecord, "id" | "name">;

export const DETAIL_FIELDS: DetailField[] = [
  "leaderTraitText",
  "normalMove",
  "superMove",
  "traitsRaw",
  "blessingTraitsRaw",
  "status",
  "exSkill",
  "chargeSkill",
  "missingLetters",
];

type CandidateMergeStats = {
  existingCount: number;
  incomingCount: number;
  addedCount: number;
  updatedCount: number;
  retainedCount: number;
  deletedCount: number;
  ignoredEmptyCount: number;
  invalidCount: number;
};

export type CandidateMergeResult = {
  candidates: CharacterDetailCandidate[];
  stats: CandidateMergeStats;
};

export type CandidateApprovalResult = {
  candidates: CharacterDetailCandidate[];
  manualCharacters: ManualCharacterRecord[];
  appliedCharacters: number;
  processedFields: number;
  manualChangedCount: number;
  removedCandidates: number;
  candidateChanged: boolean;
};

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasMove(value?: CharacterMove) {
  return Boolean(value && (hasText(value.condition) || hasText(value.effect) || value.conditions?.length));
}

function hasSkill(value?: CharacterSkill) {
  return Boolean(value && (hasText(value.name) || hasText(value.summary) || hasText(value.effect)));
}

function hasStatus(value: CharacterDetailCandidate["status"]) {
  return Boolean(
    value &&
      (value.raw?.length ||
        value.hp !== undefined ||
        value.atk !== undefined ||
        value.maxHp !== undefined ||
        value.maxAtk !== undefined ||
        value.blessedHp !== undefined ||
        value.blessedAtk !== undefined),
  );
}

function uniqueStrings(values: Array<string | undefined>) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function candidateForComparison(candidate: CharacterDetailCandidate) {
  return { ...candidate, extractedAt: "" };
}

function nonEmptyArray<T>(incoming: T[] | undefined, existing: T[] | undefined) {
  return incoming?.length ? incoming : existing;
}

function nonEmptyText(incoming: string | undefined, existing: string | undefined) {
  return hasText(incoming) ? incoming : existing;
}

function mergeCandidateData(
  existing: CharacterDetailCandidate,
  incoming: CharacterDetailCandidate,
): CharacterDetailCandidate {
  return {
    ...existing,
    characterId: existing.characterId,
    name: nonEmptyText(incoming.name, existing.name) ?? existing.name,
    sourceUrl: nonEmptyText(incoming.sourceUrl, existing.sourceUrl),
    currentLetters: nonEmptyArray(incoming.currentLetters, existing.currentLetters),
    extractedLetters: nonEmptyArray(incoming.extractedLetters, existing.extractedLetters),
    currentLetterAttributes: nonEmptyArray(
      incoming.currentLetterAttributes,
      existing.currentLetterAttributes,
    ),
    extractedLetterAttributes: nonEmptyArray(
      incoming.extractedLetterAttributes,
      existing.extractedLetterAttributes,
    ),
    missingVoicedLetters: nonEmptyArray(incoming.missingVoicedLetters, existing.missingVoicedLetters),
    letterWarnings: nonEmptyArray(incoming.letterWarnings, existing.letterWarnings),
    leaderTraitText: nonEmptyText(incoming.leaderTraitText, existing.leaderTraitText),
    normalMove: hasMove(incoming.normalMove) ? incoming.normalMove : existing.normalMove,
    superMove: hasMove(incoming.superMove) ? incoming.superMove : existing.superMove,
    moveWarnings: nonEmptyArray(incoming.moveWarnings, existing.moveWarnings),
    traitsRaw: nonEmptyArray(incoming.traitsRaw, existing.traitsRaw),
    blessingTraitsRaw: nonEmptyArray(incoming.blessingTraitsRaw, existing.blessingTraitsRaw),
    status: hasStatus(incoming.status) ? incoming.status : existing.status,
    exSkill: hasSkill(incoming.exSkill) ? incoming.exSkill : existing.exSkill,
    chargeSkill: hasSkill(incoming.chargeSkill) ? incoming.chargeSkill : existing.chargeSkill,
    rawSections: nonEmptyArray(incoming.rawSections, existing.rawSections),
    extractedAt: incoming.extractedAt || existing.extractedAt,
  };
}

export function hasCandidateField(candidate: CharacterDetailCandidate, field: DetailField) {
  if (field === "leaderTraitText") return hasText(candidate.leaderTraitText);
  if (field === "normalMove") return hasMove(candidate.normalMove);
  if (field === "superMove") return hasMove(candidate.superMove);
  if (field === "traitsRaw") return Boolean(candidate.traitsRaw?.length);
  if (field === "blessingTraitsRaw") return Boolean(candidate.blessingTraitsRaw?.length);
  if (field === "status") return hasStatus(candidate.status);
  if (field === "exSkill") return hasSkill(candidate.exSkill);
  if (field === "chargeSkill") return hasSkill(candidate.chargeSkill);
  if (field === "missingLetters") return getMissingLetterCandidates(candidate).length > 0;
  return false;
}

export function candidateFields(candidate: CharacterDetailCandidate) {
  return DETAIL_FIELDS.filter((field) => hasCandidateField(candidate, field));
}

export function hasUsableCandidateData(candidate: CharacterDetailCandidate) {
  return (
    candidateFields(candidate).length > 0 ||
    Boolean(candidate.extractedLetters?.length) ||
    Boolean(candidate.extractedLetterAttributes?.length) ||
    Boolean(candidate.rawSections?.length)
  );
}

export function mergeDetailCandidates(
  existingCandidates: CharacterDetailCandidate[],
  incomingCandidates: CharacterDetailCandidate[],
): CandidateMergeResult {
  const existingById = new Map<string, CharacterDetailCandidate>();
  for (const candidate of existingCandidates) {
    if (!hasText(candidate.characterId) || !hasText(candidate.name) || !hasText(candidate.extractedAt)) {
      throw new Error("An existing character detail candidate is missing characterId, name, or extractedAt.");
    }
    if (existingById.has(candidate.characterId)) {
      throw new Error(`Duplicate existing character detail candidate id: ${candidate.characterId}`);
    }
    existingById.set(candidate.characterId, candidate);
  }

  const mergedById = new Map(existingById);
  const addedIds = new Set<string>();
  const updatedIds = new Set<string>();
  let ignoredEmptyCount = 0;
  let invalidCount = 0;

  for (const incoming of incomingCandidates) {
    if (!hasText(incoming.characterId) || !hasText(incoming.name) || !hasText(incoming.extractedAt)) {
      invalidCount += 1;
      continue;
    }

    const existing = mergedById.get(incoming.characterId);
    if (!hasUsableCandidateData(incoming)) {
      ignoredEmptyCount += 1;
      continue;
    }

    if (!existing) {
      mergedById.set(incoming.characterId, incoming);
      addedIds.add(incoming.characterId);
      continue;
    }

    const merged = mergeCandidateData(existing, incoming);
    if (sameJson(candidateForComparison(existing), candidateForComparison(merged))) {
      continue;
    }
    mergedById.set(incoming.characterId, merged);
    if (!addedIds.has(incoming.characterId)) {
      updatedIds.add(incoming.characterId);
    }
  }

  const candidates = [...mergedById.values()].sort((left, right) => left.name.localeCompare(right.name, "ja"));
  return {
    candidates,
    stats: {
      existingCount: existingById.size,
      incomingCount: incomingCandidates.length,
      addedCount: addedIds.size,
      updatedCount: updatedIds.size,
      retainedCount: existingById.size - updatedIds.size,
      deletedCount: 0,
      ignoredEmptyCount,
      invalidCount,
    },
  };
}

export function getMissingLetterCandidates(candidate: CharacterDetailCandidate) {
  if (candidate.missingVoicedLetters?.length) {
    return uniqueStrings(candidate.missingVoicedLetters);
  }
  const current = new Set(candidate.currentLetters ?? []);
  return uniqueStrings([
    ...(candidate.extractedLetters ?? []).filter((letter) => !current.has(letter)),
    ...(candidate.extractedLetterAttributes ?? [])
      .map((item) => item.letter)
      .filter((letter) => !current.has(letter)),
  ]);
}

function mergeMove(existing: CharacterMove | undefined, candidate: CharacterMove | undefined) {
  if (!hasMove(candidate)) return existing;
  return {
    ...(existing ?? {}),
    ...(hasText(candidate?.condition) ? { condition: candidate.condition } : {}),
    ...(candidate?.conditions?.length ? { conditions: candidate.conditions } : {}),
    ...(hasText(candidate?.effect) ? { effect: candidate.effect } : {}),
  };
}

function mergeSkill(existing: CharacterSkill | undefined, candidate: CharacterSkill | undefined) {
  if (!hasSkill(candidate)) return existing;
  return {
    ...(existing ?? {}),
    ...(hasText(candidate?.name) ? { name: candidate.name } : {}),
    ...(hasText(candidate?.summary) ? { summary: candidate.summary } : {}),
    ...(hasText(candidate?.effect) ? { effect: candidate.effect } : {}),
  };
}

function mergeLetterAttributes(
  existing: CharacterLetter[] | undefined,
  candidate: CharacterDetailCandidate,
  lettersToAdd: string[],
) {
  const byLetter = new Map<string, CharacterLetter>();
  for (const item of existing ?? []) {
    const letter = String(item.letter ?? "").trim();
    if (!letter) continue;
    byLetter.set(letter, { letter, attributes: uniqueStrings(item.attributes ?? []) });
  }
  for (const letter of lettersToAdd) {
    const extracted = candidate.extractedLetterAttributes?.find((item) => item.letter === letter);
    const current = byLetter.get(letter);
    byLetter.set(letter, {
      letter,
      attributes: uniqueStrings([...(current?.attributes ?? []), ...(extracted?.attributes ?? [])]),
    });
  }
  return [...byLetter.values()];
}

function applyCandidateFields(
  manual: ManualCharacterRecord,
  candidate: CharacterDetailCandidate,
  fields: DetailField[],
  requestedLetters: string[],
) {
  const selected = new Set(fields);
  const next: ManualCharacterRecord = { ...manual };
  const processedFields: DetailField[] = [];
  const availableLetters = new Set(getMissingLetterCandidates(candidate));
  const lettersToAdd = uniqueStrings(requestedLetters).filter((letter) => availableLetters.has(letter));

  if (selected.has("leaderTraitText") && hasText(candidate.leaderTraitText)) {
    next.leaderTraitText = candidate.leaderTraitText;
    processedFields.push("leaderTraitText");
  }
  if (selected.has("normalMove") && hasMove(candidate.normalMove)) {
    next.normalMove = mergeMove(next.normalMove, candidate.normalMove);
    processedFields.push("normalMove");
  }
  if (selected.has("superMove") && hasMove(candidate.superMove)) {
    next.superMove = mergeMove(next.superMove, candidate.superMove);
    processedFields.push("superMove");
  }
  if (selected.has("traitsRaw") && candidate.traitsRaw?.length) {
    next.traitsRaw = uniqueStrings(candidate.traitsRaw);
    processedFields.push("traitsRaw");
  }
  if (selected.has("blessingTraitsRaw") && candidate.blessingTraitsRaw?.length) {
    next.blessingTraitsRaw = uniqueStrings(candidate.blessingTraitsRaw);
    processedFields.push("blessingTraitsRaw");
  }
  if (selected.has("status") && hasStatus(candidate.status)) {
    next.status = {
      ...(next.status ?? {}),
      ...candidate.status,
      ...(candidate.status?.raw?.length ? { raw: uniqueStrings(candidate.status.raw) } : {}),
    };
    processedFields.push("status");
  }
  if (selected.has("exSkill") && hasSkill(candidate.exSkill)) {
    next.exSkill = mergeSkill(next.exSkill, candidate.exSkill);
    processedFields.push("exSkill");
  }
  if (selected.has("chargeSkill") && hasSkill(candidate.chargeSkill)) {
    next.chargeSkill = mergeSkill(next.chargeSkill, candidate.chargeSkill);
    processedFields.push("chargeSkill");
  }
  if (selected.has("missingLetters") && lettersToAdd.length) {
    next.letters = uniqueStrings([...(candidate.currentLetters ?? []), ...(next.letters ?? []), ...lettersToAdd]);
    next.letterAttributes = mergeLetterAttributes(
      [...(candidate.currentLetterAttributes ?? []), ...(next.letterAttributes ?? [])],
      candidate,
      lettersToAdd,
    );
    processedFields.push("missingLetters");
  }

  return {
    record: next,
    processedFields,
    lettersToAdd,
    changed: !sameJson(manual, next),
  };
}

function remainingCandidate(
  candidate: CharacterDetailCandidate,
  processedFields: DetailField[],
  lettersToAdd: string[],
) {
  const next: CharacterDetailCandidate = { ...candidate };
  for (const field of processedFields) {
    if (field === "missingLetters") continue;
    delete next[field];
  }

  if (processedFields.includes("missingLetters")) {
    const removed = new Set(lettersToAdd);
    next.currentLetters = uniqueStrings([...(next.currentLetters ?? []), ...lettersToAdd]);
    next.currentLetterAttributes = mergeLetterAttributes(
      next.currentLetterAttributes,
      candidate,
      lettersToAdd,
    );
    next.missingVoicedLetters = (next.missingVoicedLetters ?? []).filter((letter) => !removed.has(letter));
  }

  return candidateFields(next).length ? next : null;
}

export function applyCandidateApprovals(input: {
  candidates: CharacterDetailCandidate[];
  manualCharacters: ManualCharacterRecord[];
  baseCharacters: Array<Pick<CharacterRecord, "id" | "name" | "sourceUrl">>;
  characterIds: string[];
  fieldsByCharacterId?: Record<string, DetailField[]>;
  lettersByCharacterId?: Record<string, string[]>;
  updatedAt: string;
}): CandidateApprovalResult {
  const applyIds = new Set(input.characterIds);
  const baseById = new Map(input.baseCharacters.map((character) => [character.id, character]));
  const manualCharacters = input.manualCharacters.map((character) => ({ ...character }));
  const manualIndexById = new Map(manualCharacters.map((character, index) => [character.id, index]));
  let appliedCharacters = 0;
  let processedFields = 0;
  let manualChangedCount = 0;
  let removedCandidates = 0;
  let candidateChanged = false;

  const candidates = input.candidates.flatMap((candidate) => {
    if (!applyIds.has(candidate.characterId)) return [candidate];

    const hasExplicitFields = Object.prototype.hasOwnProperty.call(
      input.fieldsByCharacterId ?? {},
      candidate.characterId,
    );
    const fields = hasExplicitFields
      ? (input.fieldsByCharacterId?.[candidate.characterId] ?? [])
      : DETAIL_FIELDS;
    const index = manualIndexById.get(candidate.characterId);
    const baseCharacter = baseById.get(candidate.characterId);
    const base: ManualCharacterRecord =
      index !== undefined
        ? manualCharacters[index]
        : {
            id: candidate.characterId,
            name: baseCharacter?.name ?? candidate.name,
            sourceUrl: baseCharacter?.sourceUrl ?? candidate.sourceUrl,
          };
    const applied = applyCandidateFields(
      base,
      candidate,
      fields,
      input.lettersByCharacterId?.[candidate.characterId] ?? [],
    );

    if (!applied.processedFields.length) return [candidate];

    appliedCharacters += 1;
    processedFields += applied.processedFields.length;
    candidateChanged = true;
    if (applied.changed) {
      const next = { ...applied.record, updatedAt: input.updatedAt, updatedByManual: true };
      if (index !== undefined) {
        manualCharacters[index] = next;
      } else {
        manualIndexById.set(next.id, manualCharacters.length);
        manualCharacters.push(next);
      }
      manualChangedCount += 1;
    }

    const remaining = remainingCandidate(candidate, applied.processedFields, applied.lettersToAdd);
    if (!remaining) {
      removedCandidates += 1;
      return [];
    }
    return [remaining];
  });

  return {
    candidates,
    manualCharacters,
    appliedCharacters,
    processedFields,
    manualChangedCount,
    removedCandidates,
    candidateChanged,
  };
}
