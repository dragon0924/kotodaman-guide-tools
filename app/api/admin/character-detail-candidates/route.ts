import { isAdminRequest } from "@/lib/server/adminAuth";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import {
  applyCandidateApprovals,
  type DetailField,
  type ManualCharacterRecord,
} from "@/lib/characterDetailCandidates";
import { clearCharacterCache, getCharacterCache } from "@/lib/characterStore";
import { writeJsonFilesSafely, type JsonFileWrite } from "@/lib/server/safeJsonFiles";
import type { CharacterDetailCandidate } from "@/lib/types";

type ManualCharacterFile = {
  meta?: {
    updatedAt?: string | null;
    policy?: string;
  };
  characters?: ManualCharacterRecord[];
};

type DetailCandidateFile = {
  meta?: Record<string, unknown>;
  candidates?: CharacterDetailCandidate[];
};

type ApplyRequest = {
  characterIds?: string[];
  fieldsByCharacterId?: Record<string, DetailField[]>;
  lettersByCharacterId?: Record<string, string[]>;
};

const CANDIDATE_PATH = path.join(process.cwd(), "data", "characterDetailCandidates.json");
const MANUAL_PATH = path.join(process.cwd(), "data", "characters.manual.json");
function unauthorized() {
  return new NextResponse("Unauthorized", { status: 401 });
}

function assertAdmin(request: NextRequest) {
  return isAdminRequest(request);
}

async function readCandidates(): Promise<DetailCandidateFile> {
  try {
    const parsed = JSON.parse(await readFile(CANDIDATE_PATH, "utf8")) as DetailCandidateFile;
    if (parsed.candidates !== undefined && !Array.isArray(parsed.candidates)) {
      throw new Error("Invalid character detail candidate file.");
    }
    return {
      meta: parsed.meta ?? {},
      candidates: Array.isArray(parsed.candidates) ? parsed.candidates : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { meta: {}, candidates: [] };
    }
    throw error;
  }
}

async function readManualFile(): Promise<ManualCharacterFile> {
  try {
    const parsed = JSON.parse(await readFile(MANUAL_PATH, "utf8")) as ManualCharacterFile;
    if (parsed.characters !== undefined && !Array.isArray(parsed.characters)) {
      throw new Error("Invalid manual character file.");
    }
    return {
      meta: parsed.meta ?? {},
      characters: Array.isArray(parsed.characters) ? parsed.characters.map(stripSearchOnlyFields) : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        meta: {
          updatedAt: null,
          policy: "Manual overrides for local character editing.",
        },
        characters: [],
      };
    }
    throw error;
  }
}

function stripSearchOnlyFields(character: ManualCharacterRecord): ManualCharacterRecord {
  const {
    searchText,
    normalizedAttributes,
    normalizedSpecies,
    normalizedLeaderTraits,
    normalizedGimmicks,
    normalizedSuperGimmicks,
    normalizedGroups,
    normalizedCollabGroups,
    normalizedLetters,
    normalizedTraits,
    normalizedRarityType,
    renderedTraits,
    ...rest
  } = character as ManualCharacterRecord & Record<string, unknown>;
  void searchText;
  void normalizedAttributes;
  void normalizedSpecies;
  void normalizedLeaderTraits;
  void normalizedGimmicks;
  void normalizedSuperGimmicks;
  void normalizedGroups;
  void normalizedCollabGroups;
  void normalizedLetters;
  void normalizedTraits;
  void normalizedRarityType;
  void renderedTraits;
  return rest;
}

function validateCandidateFile(value: unknown) {
  if (!value || typeof value !== "object" || !Array.isArray((value as DetailCandidateFile).candidates)) {
    throw new Error("Invalid character detail candidate file.");
  }
  for (const candidate of (value as DetailCandidateFile).candidates ?? []) {
    if (!candidate?.characterId?.trim() || !candidate.name?.trim() || !candidate.extractedAt?.trim()) {
      throw new Error("A character detail candidate is missing characterId, name, or extractedAt.");
    }
  }
}

function validateManualFile(value: unknown) {
  if (!value || typeof value !== "object" || !Array.isArray((value as ManualCharacterFile).characters)) {
    throw new Error("Invalid manual character file.");
  }
  for (const character of (value as ManualCharacterFile).characters ?? []) {
    if (!character?.id?.trim() || !character.name?.trim()) {
      throw new Error("A manual character record is missing id or name.");
    }
  }
}

export async function GET(request: NextRequest) {
  if (!assertAdmin(request)) {
    return unauthorized();
  }
  const [candidateFile, cache] = await Promise.all([readCandidates(), getCharacterCache()]);
  const byId = new Map(cache.characters.map((character) => [character.id, character]));
  return NextResponse.json({
    path: "data/characterDetailCandidates.json",
    meta: candidateFile.meta ?? {},
    total: candidateFile.candidates?.length ?? 0,
    candidates: (candidateFile.candidates ?? []).map((candidate) => ({
      ...candidate,
      currentName: byId.get(candidate.characterId)?.name ?? candidate.name,
    })),
  });
}

export async function PUT(request: NextRequest) {
  if (!assertAdmin(request)) {
    return unauthorized();
  }
  const payload = (await request.json()) as ApplyRequest;
  const [candidateFile, cache, manualFile] = await Promise.all([
    readCandidates(),
    getCharacterCache(),
    readManualFile(),
  ]);
  const now = new Date().toISOString();
  const result = applyCandidateApprovals({
    candidates: candidateFile.candidates ?? [],
    manualCharacters: manualFile.characters ?? [],
    baseCharacters: cache.characters,
    characterIds: payload.characterIds ?? [],
    fieldsByCharacterId: payload.fieldsByCharacterId,
    lettersByCharacterId: payload.lettersByCharacterId,
    updatedAt: now,
  });
  const nextManualFile: ManualCharacterFile = {
    meta: {
      ...(manualFile.meta ?? {}),
      ...(result.manualChangedCount ? { updatedAt: now } : {}),
      policy: "Manual overrides for local character editing.",
    },
    characters: result.manualCharacters.map(stripSearchOnlyFields),
  };
  const nextCandidateFile: DetailCandidateFile = {
    meta: {
      ...(candidateFile.meta ?? {}),
      ...(result.candidateChanged ? { updatedAt: now } : {}),
    },
    candidates: result.candidates,
  };
  const writes: JsonFileWrite[] = [];
  if (result.manualChangedCount) {
    writes.push({ path: MANUAL_PATH, value: nextManualFile, validate: validateManualFile });
  }
  if (result.candidateChanged) {
    writes.push({ path: CANDIDATE_PATH, value: nextCandidateFile, validate: validateCandidateFile });
  }
  if (writes.length) {
    await writeJsonFilesSafely(writes);
  }
  if (result.manualChangedCount) {
    clearCharacterCache();
  }

  return NextResponse.json({
    applied: result.appliedCharacters,
    processedFields: result.processedFields,
    manualChanged: result.manualChangedCount,
    removedCandidates: result.removedCandidates,
    total: candidateFile.candidates?.length ?? 0,
    remaining: result.candidates.length,
  });
}
