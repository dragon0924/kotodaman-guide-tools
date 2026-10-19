import { isAdminRequest } from "@/lib/server/adminAuth";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { clearCharacterCache } from "@/lib/characterStore";
import { normalizeGimmickList, normalizeSuperGimmickList } from "@/lib/gimmicks";
import { normalizeKotowaza, normalizeMove } from "@/lib/moveConditions";
import { normalizeRarityType } from "@/lib/rarity";
import { normalizeTraitEntries } from "@/lib/traits";
import type { CharacterLetter, CharacterRecord, CharacterSkill, RelatedCharacter } from "@/lib/types";

type ManualCharacterFile = {
  meta?: {
    updatedAt?: string | null;
    policy?: string;
  };
  characters?: CharacterRecord[];
};

const MANUAL_PATH = path.join(process.cwd(), "data", "characters.manual.json");

function unauthorized() {
  return new NextResponse("Unauthorized", { status: 401 });
}

function assertAdmin(request: NextRequest) {
  return isAdminRequest(request);
}

async function readManualFile(): Promise<ManualCharacterFile> {
  try {
    const payload = await readFile(MANUAL_PATH, "utf8");
    const parsed = JSON.parse(payload) as ManualCharacterFile;
    return {
      meta: parsed.meta ?? {},
      characters: Array.isArray(parsed.characters) ? parsed.characters : [],
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

function stringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)));
}

function normalizeLetterAttributes(value: unknown, letters: string[], attributes: string[]): CharacterLetter[] {
  const raw = Array.isArray(value) ? value : [];
  const byLetter = new Map<string, Set<string>>();
  for (const item of raw) {
    const letter = String(item?.letter ?? "").trim();
    if (!letter || !letters.includes(letter)) {
      continue;
    }
    byLetter.set(letter, new Set(stringArray(item?.attributes)));
  }
  return letters.map((letter) => {
    const itemAttributes = Array.from(byLetter.get(letter) ?? new Set(attributes));
    return {
      letter,
      attributes: itemAttributes.length ? itemAttributes : attributes,
    };
  });
}

function normalizeSkill(value: unknown): CharacterSkill | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const raw = value as Partial<CharacterSkill>;
  const skill = {
    name: String(raw.name ?? "").trim(),
    summary: String(raw.summary ?? "").trim(),
    effect: String(raw.effect ?? "").trim(),
  };
  return skill.name || skill.summary || skill.effect ? skill : undefined;
}

function normalizeRelatedCharacters(value: unknown): RelatedCharacter[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => ({
      characterId: String(item?.characterId ?? item ?? "").trim(),
      memo: String(item?.memo ?? "").trim() || undefined,
    }))
    .filter((item) => item.characterId);
}

function makeManualId(character: Partial<CharacterRecord>) {
  const source = `${character.sourceUrl ?? ""}::${character.name ?? ""}::${Date.now()}`;
  return `manual-${createHash("sha1").update(source).digest("hex").slice(0, 16)}`;
}

function normalizeCharacterPayload(payload: Partial<CharacterRecord>): CharacterRecord {
  const attributes = stringArray(payload.attributes?.length ? payload.attributes : payload.attribute ? [payload.attribute] : []);
  const letters = stringArray(payload.letters);
  const now = new Date().toISOString();
  return {
    id: String(payload.id ?? "").trim() || makeManualId(payload),
    name: String(payload.name ?? "").trim(),
    attribute: attributes[0] ?? "",
    attributes,
    race: String(payload.species ?? payload.race ?? "").trim() || "不明",
    species: String(payload.species ?? payload.race ?? "").trim() || "不明",
    letters,
    letterAttributes: normalizeLetterAttributes(payload.letterAttributes, letters, attributes),
    leaderTraits: stringArray(payload.leaderTraits),
    gimmicks: normalizeGimmickList(stringArray(payload.gimmicks)),
    superGimmicks: normalizeSuperGimmickList(stringArray(payload.superGimmicks)),
    groups: stringArray(payload.groups),
    collabGroups: stringArray(payload.collabGroups),
    rating: String(payload.rating ?? "").trim(),
    sourceUrl: String(payload.sourceUrl ?? "").trim(),
    updatedAt: now,
    imageUrl: String(payload.imageUrl ?? "").trim() || undefined,
    imageSourceUrl: String(payload.imageSourceUrl ?? payload.sourceUrl ?? "").trim() || undefined,
    memo: String(payload.memo ?? "").trim() || undefined,
    review: String(payload.review ?? "").trim() || undefined,
    recommendedQuests: stringArray(payload.recommendedQuests),
    adminMemo: String(payload.adminMemo ?? "").trim() || undefined,
    leaderTraitText: String(payload.leaderTraitText ?? "").trim() || undefined,
    normalMove: normalizeMove(payload.normalMove),
    superMove: normalizeMove(payload.superMove),
    exSkill: normalizeSkill(payload.exSkill),
    chargeSkill: normalizeSkill(payload.chargeSkill),
    kotowaza: normalizeKotowaza(payload.kotowaza),
    traits: normalizeTraitEntries(payload.traits),
    rarityType: normalizeRarityType(payload.rarityType),
    relatedCharacters: normalizeRelatedCharacters(payload.relatedCharacters),
    relatedCharacterIds: stringArray(payload.relatedCharacterIds),
    obtainedQuestIds: stringArray(payload.obtainedQuestIds),
    recommendedQuestIds: stringArray(payload.recommendedQuestIds),
    updatedByManual: true,
  };
}

export async function GET(request: NextRequest) {
  if (!assertAdmin(request)) {
    return unauthorized();
  }
  const file = await readManualFile();
  return NextResponse.json({
    path: "data/characters.manual.json",
    total: file.characters?.length ?? 0,
    ...file,
  });
}

export async function PUT(request: NextRequest) {
  if (!assertAdmin(request)) {
    return unauthorized();
  }
  const payload = (await request.json()) as Partial<CharacterRecord>;
  const character = normalizeCharacterPayload(payload);
  if (!character.name) {
    return new NextResponse("キャラ名は必須です", { status: 400 });
  }

  const file = await readManualFile();
  const characters = file.characters ?? [];
  const index = characters.findIndex((item) => item.id === character.id);
  if (index >= 0) {
    characters[index] = character;
  } else {
    characters.push(character);
  }
  await writeManualFile({
    meta: {
      ...(file.meta ?? {}),
      updatedAt: new Date().toISOString(),
      policy: "自動取得データを直接編集せず、管理画面からの手動補正を保存します。",
    },
    characters,
  });
  return NextResponse.json({ character, total: characters.length });
}

export async function DELETE(request: NextRequest) {
  if (!assertAdmin(request)) {
    return unauthorized();
  }
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return new NextResponse("id is required", { status: 400 });
  }
  const file = await readManualFile();
  const characters = (file.characters ?? []).filter((item) => item.id !== id);
  await writeManualFile({
    meta: {
      ...(file.meta ?? {}),
      updatedAt: new Date().toISOString(),
    },
    characters,
  });
  return NextResponse.json({ id, total: characters.length });
}
