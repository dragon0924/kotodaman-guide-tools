import { isAdminRequest } from "@/lib/server/adminAuth";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { clearCharacterCache, getCharacterCache } from "@/lib/characterStore";
import type { CharacterRarityType, CharacterRecord, SpecialRarityCandidate } from "@/lib/types";

type ManualCharacterRecord = Partial<CharacterRecord> & Pick<CharacterRecord, "id" | "name">;

type ManualCharacterFile = {
  meta?: {
    updatedAt?: string | null;
    policy?: string;
  };
  characters?: ManualCharacterRecord[];
};

type ApplyRequest = {
  characterIds?: string[];
  excludeIds?: string[];
  dryRun?: boolean;
};

type RarityConflict = {
  characterId: string;
  name: string;
  currentRarityType: CharacterRarityType;
  candidateRarityTypes: Array<Exclude<CharacterRarityType, "">>;
  reason: "existing-rarity-conflict" | "ambiguous-candidates";
};

const CANDIDATE_PATH = path.join(process.cwd(), "data", "specialRarityCandidates.json");
const MANUAL_PATH = path.join(process.cwd(), "data", "characters.manual.json");

function unauthorized() {
  return new NextResponse("Unauthorized", { status: 401 });
}

function assertAdmin(request: NextRequest) {
  return isAdminRequest(request);
}

async function readCandidates(): Promise<SpecialRarityCandidate[]> {
  try {
    const parsed = JSON.parse(await readFile(CANDIDATE_PATH, "utf8")) as SpecialRarityCandidate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeCandidates(candidates: SpecialRarityCandidate[]) {
  await mkdir(path.dirname(CANDIDATE_PATH), { recursive: true });
  await writeFile(CANDIDATE_PATH, `${JSON.stringify(candidates, null, 2)}\n`, "utf8");
}

async function readManualFile(): Promise<ManualCharacterFile> {
  try {
    const payload = await readFile(MANUAL_PATH, "utf8");
    const parsed = JSON.parse(payload) as ManualCharacterFile;
    return {
      meta: parsed.meta ?? {},
      characters: Array.isArray(parsed.characters) ? parsed.characters.map(stripSearchOnlyFields) : [],
    };
  } catch {
    return {
      meta: {
        updatedAt: null,
        policy: "Manual overrides for local character editing.",
      },
      characters: [],
    };
  }
}

async function writeManualFile(file: ManualCharacterFile) {
  await mkdir(path.dirname(MANUAL_PATH), { recursive: true });
  await writeFile(MANUAL_PATH, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  clearCharacterCache();
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

function manualRarityOverride(
  character: CharacterRecord,
  rarityType: Exclude<CharacterRarityType, "">,
): ManualCharacterRecord {
  return {
    id: character.id,
    name: character.name,
    rarityType,
    updatedAt: new Date().toISOString(),
    updatedByManual: true,
  };
}

export async function GET(request: NextRequest) {
  if (!assertAdmin(request)) {
    return unauthorized();
  }
  const [candidates, cache] = await Promise.all([readCandidates(), getCharacterCache()]);
  const byId = new Map(cache.characters.map((character) => [character.id, character]));
  return NextResponse.json({
    path: "data/specialRarityCandidates.json",
    total: candidates.length,
    candidates: candidates.map((candidate) => ({
      ...candidate,
      currentRarityType: byId.get(candidate.characterId)?.rarityType ?? candidate.currentRarityType ?? "",
    })),
  });
}

export async function PUT(request: NextRequest) {
  if (!assertAdmin(request)) {
    return unauthorized();
  }
  const payload = (await request.json()) as ApplyRequest;
  const applyIds = new Set(payload.characterIds ?? []);
  const excludeIds = new Set(payload.excludeIds ?? []);
  const [candidates, cache, manualFile] = await Promise.all([
    readCandidates(),
    getCharacterCache(),
    readManualFile(),
  ]);
  const byId = new Map(cache.characters.map((character) => [character.id, character]));
  const manualCharacters = manualFile.characters ?? [];
  const appliedIds = new Set<string>();
  const manualUpdateIds = new Set<string>();
  const conflicts: RarityConflict[] = [];

  for (const id of applyIds) {
    const character = byId.get(id);
    const rarityTypes = Array.from(
      new Set(
        candidates
          .filter((candidate) => candidate.characterId === id)
          .map((candidate) => candidate.candidateRarityType),
      ),
    );
    if (!character) {
      continue;
    }
    if (rarityTypes.length !== 1) {
      conflicts.push({
        characterId: id,
        name: character.name,
        currentRarityType: character.rarityType ?? "",
        candidateRarityTypes: rarityTypes,
        reason: "ambiguous-candidates",
      });
      continue;
    }
    const rarityType = rarityTypes[0];
    if (character.rarityType && character.rarityType !== rarityType) {
      conflicts.push({
        characterId: id,
        name: character.name,
        currentRarityType: character.rarityType,
        candidateRarityTypes: rarityTypes,
        reason: "existing-rarity-conflict",
      });
      continue;
    }
    appliedIds.add(id);
    if (character.rarityType === rarityType) {
      continue;
    }
    manualUpdateIds.add(id);
    const index = manualCharacters.findIndex((item) => item.id === id);
    if (index >= 0) {
      manualCharacters[index] = {
        ...stripSearchOnlyFields(manualCharacters[index]),
        rarityType,
        updatedAt: new Date().toISOString(),
        updatedByManual: true,
      };
    } else {
      manualCharacters.push(manualRarityOverride(character, rarityType));
    }
  }

  const now = new Date().toISOString();
  const nextCandidates = candidates.map((candidate) => {
    if (appliedIds.has(candidate.characterId)) {
      return { ...candidate, status: "applied" as const, updatedAt: now };
    }
    if (excludeIds.has(candidate.characterId)) {
      return { ...candidate, status: "excluded" as const, updatedAt: now };
    }
    return candidate;
  });

  if (!payload.dryRun) {
    if (manualUpdateIds.size) {
      await writeManualFile({
        meta: {
          ...(manualFile.meta ?? {}),
          updatedAt: now,
          policy: "自動取得データを直接編集せず、管理画面からの手動補正を保存します。",
        },
        characters: manualCharacters.map(stripSearchOnlyFields),
      });
    }
    if (appliedIds.size || excludeIds.size) {
      await writeCandidates(nextCandidates);
    }
  }

  return NextResponse.json({
    applied: appliedIds.size,
    excluded: excludeIds.size,
    conflicts,
    dryRun: Boolean(payload.dryRun),
    total: nextCandidates.length,
    candidates: nextCandidates,
  });
}
