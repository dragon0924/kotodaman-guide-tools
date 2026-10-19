import { readFile, stat } from "node:fs/promises";
import { publicCharacterFields } from "./publicCharacter";
import path from "node:path";
import { supplementTraitMatchIndex, type SupplementalTraitFile } from "./newCharacterTraitMatches";
import { partitionDisplayTraits } from "./characterDetailDisplay";
import { applyCharacterDetailRecoveries, parseCharacterDetailRecoveries } from "./characterDetailRecovery";
import { buildTraitSearchIndex, indexTraitSearchEvidence, matchesTraitSearch, parseReviewedTraitSearchSources, type TraitSearchCharacterIndex } from "./traitSearch";
import { normalizeGimmickList, normalizeSuperGimmickList, normalizeSuperGimmickName } from "./gimmicks";
import { getGroupDisplayMap, groupOrderMtime, readGroupOrder, sortGroupsByOrder } from "./groupOrder";
import type { GroupOrderEntry } from "./groupOrder";
import { kotowazaSearchText, moveConditionSearchText, normalizeKotowaza, normalizeMove } from "./moveConditions";
import { SPECIAL_RARITY_TYPES, normalizeRarityType, sortRarityTypes } from "./rarity";
import { readTraitMaster, traitMasterMtime } from "./traitMasterStore";
import { normalizeTraitEntries, traitSearchText, traitTemplateNames } from "./traits";
import type {
  CharacterDataMeta,
  CharacterLetter,
  CharacterRecord,
  CharacterSearchFilters,
  CharacterSearchMatchMode,
  CharacterSearchResult,
  TraitTemplate,
} from "./types";

type CharacterFile = {
  meta?: {
    generatedAt?: string | null;
    updatedAt?: string | null;
    policy?: string;
  };
  characters?: Partial<CharacterRecord>[];
};

type TraitTemplateMatchFile = {
  matches?: Array<{
    characterId?: string;
    matchedTemplateId?: string;
    matchedTemplateName?: string;
    status?: string;
  }>;
};

type TraitTemplateMatchIndex = Map<string, {
  ids: string[];
  names: string[];
}>;

type IndexedCharacter = CharacterRecord & {
  searchText: string;
  normalizedAttributes: string[];
  normalizedSpecies: string[];
  normalizedLeaderTraits: string[];
  normalizedGimmicks: string[];
  normalizedSuperGimmicks: string[];
  normalizedGroups: string[];
  normalizedCollabGroups: string[];
  normalizedLetters: string[];
  normalizedTraits: string[];
  normalizedRarityType: string[];
};

type CharacterCache = {
  characters: IndexedCharacter[];
  traitSearchIndex: TraitSearchCharacterIndex;
  meta: CharacterDataMeta;
  signature: string;
};

const AUTO_PATH = path.join(process.cwd(), "data", "characters.json");
const MANUAL_PATH = path.join(process.cwd(), "data", "characters.manual.json");
const DETAIL_RECOVERY_PATH = path.join(process.cwd(), "data", "characterDetailRecoveries.json");
const TRAIT_TEMPLATE_MATCHES_PATH = path.join(process.cwd(), "data", "traitTemplateMatches.json");
const NEW_TRAIT_MATCHES_PATH = path.join(process.cwd(), "data", "traitTemplateMatches.newCharacters.json");
const REVIEWED_TRAIT_SOURCES_PATH = path.join(process.cwd(), "data", "traitSearchReviewedSources.json");
const POLICY = "通常のブラウザ表示で画面上に見えるDOMテキストだけを取得対象にする";
const SEARCH_LIMIT = 50;
const COLLAB_GROUP_ALIASES: Record<string, string[]> = {};

const EXTRA_COLLAB_GROUPS: GroupOrderEntry[] = [];

let cache: CharacterCache | null = null;
let cachePromise: Promise<CharacterCache> | null = null;

async function fileMtime(filePath: string) {
  try {
    return String((await stat(filePath)).mtimeMs);
  } catch {
    return "missing";
  }
}

async function dataSignature() {
  const [autoMtime, manualMtime, orderMtime, traitMtime, traitTemplateMatchesMtime, newTraitMatchesMtime, reviewedTraitMtime, recoveryMtime] = await Promise.all([
    fileMtime(AUTO_PATH),
    fileMtime(MANUAL_PATH),
    groupOrderMtime(),
    traitMasterMtime(),
    fileMtime(TRAIT_TEMPLATE_MATCHES_PATH),
    fileMtime(NEW_TRAIT_MATCHES_PATH),
    fileMtime(REVIEWED_TRAIT_SOURCES_PATH),
    fileMtime(DETAIL_RECOVERY_PATH),
  ]);
  return `${autoMtime}:${manualMtime}:${orderMtime}:${traitMtime}:${traitTemplateMatchesMtime}:${newTraitMatchesMtime}:${reviewedTraitMtime}:${recoveryMtime}`;
}

async function readCharacterFile(filePath: string, options: { normalize?: boolean } = {}): Promise<CharacterFile> {
  const payload = await readFile(filePath, "utf8");
  const parsed = JSON.parse(payload) as CharacterFile;
  if (!Array.isArray(parsed.characters)) {
    throw new Error(`${filePath} の characters は配列ではありません。`);
  }
  return {
    ...parsed,
    characters: options.normalize === false
      ? parsed.characters
      : parsed.characters.map((character) => normalizeCharacter(character as CharacterRecord)),
  };
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function normalizeText(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

function normalizeAttribute(value: string) {
  const normalized = normalizeText(value).replace(/属性/g, "");
  if (!normalized) return "";
  if (normalized.includes("rainbow") || normalized.includes("虹")) return "虹";
  if (normalized.includes("火")) return "火";
  if (normalized.includes("水")) return "水";
  if (normalized.includes("木")) return "木";
  if (normalized.includes("光")) return "光";
  if (normalized.includes("闇")) return "闇";
  if (normalized.includes("冥")) return "冥";
  if (normalized.includes("天")) return "天";
  return value.trim();
}

function normalizeSpecies(value: string) {
  const normalized = normalizeText(value).replace(/種族/g, "");
  if (!normalized || normalized === "不明" || normalized === "未取得") return "不明";
  if (normalized.includes("英雄")) return "英雄";
  if (normalized.includes("神")) return "神";
  if (normalized.includes("龍") || normalized.includes("竜")) return "龍";
  if (normalized.includes("物")) return "物";
  if (normalized.includes("獣")) return "獣";
  if (normalized.includes("霊")) return "霊";
  if (normalized.includes("魔")) return "魔";
  if (normalized.includes("妖")) return "妖";
  if (normalized.includes("英")) return "英";
  return value.trim();
}

function speciesSearchCategory(value: string) {
  const species = normalizeSpecies(value);
  return species === "英雄" ? "英" : species;
}

function normalizeTrait(value: string) {
  return normalizeText(value).replace(/耐性/g, "");
}

function collabEntryNames(entries: GroupOrderEntry[]) {
  return unique(entries.flatMap((entry) => [entry.name, entry.displayName ?? ""]));
}

function inferCollabGroups(character: CharacterRecord, collabEntries: GroupOrderEntry[]) {
  const explicit = unique(character.collabGroups ?? []);
  const searchable = normalizeText([
    character.name,
    character.leaderTraitText ?? "",
    character.traitsRaw?.join(" ") ?? "",
    character.traits?.map((trait) => typeof trait === "string" ? trait : "").join(" ") ?? "",
  ].join(" "));
  const inferred = collabEntries
    .filter((entry) => {
      const candidates = unique([entry.name, entry.displayName ?? entry.name, ...(COLLAB_GROUP_ALIASES[entry.name] ?? [])]);
      return candidates.some((candidate) => searchable.includes(normalizeText(candidate)));
    })
    .map((entry) => entry.name);
  return unique([...explicit, ...inferred]);
}

function applyInferredCollabGroups(characters: CharacterRecord[], collabEntries: GroupOrderEntry[]) {
  return characters.map((character) => ({ ...character, collabGroups: inferCollabGroups(character, collabEntries) }));
}
function normalizeGimmick(value: string) {
  return normalizeText(value)
    .replace(/^s(?=バルーン|ビリビリ|トゲ|チェンジ|コピー|シールド|スマッシュ|ヒール|フリーズ|ウォール|弱体|地雷)/, "スーパー")
    .replace(/ガード/g, "")
    .replace(/ブレイカー/g, "")
    .replace(/耐性/g, "");
}

function normalizeLetter(value: string) {
  return value.normalize("NFKC").trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

async function readNewTraitMatches(): Promise<SupplementalTraitFile | null> {
  try {
    const file = JSON.parse(await readFile(NEW_TRAIT_MATCHES_PATH, "utf8")) as SupplementalTraitFile;
    if (!Array.isArray(file.meta?.characterIds) || !Array.isArray(file.matches)) throw new Error("Invalid new-character trait matches");
    return file;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function readTraitTemplateMatchIndex(): Promise<TraitTemplateMatchIndex> {
  try {
    const payload = JSON.parse(await readFile(TRAIT_TEMPLATE_MATCHES_PATH, "utf8")) as TraitTemplateMatchFile;
    const byCharacterId = new Map<string, { ids: Set<string>; names: Set<string> }>();
    for (const match of payload.matches ?? []) {
      if (match.status !== "matched" || !match.characterId || !match.matchedTemplateId) {
        continue;
      }
      const entry = byCharacterId.get(match.characterId) ?? { ids: new Set<string>(), names: new Set<string>() };
      entry.ids.add(match.matchedTemplateId);
      if (match.matchedTemplateName) {
        entry.names.add(match.matchedTemplateName);
      }
      byCharacterId.set(match.characterId, entry);
    }
    return new Map(
      [...byCharacterId.entries()].map(([characterId, entry]) => [
        characterId,
        {
          ids: [...entry.ids],
          names: [...entry.names],
        },
      ]),
    );
  } catch {
    return new Map();
  }
}

function hasOwn<T extends object>(value: T, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function manualArray<T>(
  manual: Partial<CharacterRecord>,
  key: keyof CharacterRecord,
  fallback: T[] | undefined,
): T[] {
  return hasOwn(manual, key) ? ((manual[key] as T[] | undefined) ?? []) : (fallback ?? []);
}

function normalizeAttributeList(raw: CharacterRecord) {
  const attributes = toStringArray(raw.attributes).map(normalizeAttribute).filter(Boolean);
  if (attributes.length > 0) {
    return unique(attributes);
  }
  const attribute = normalizeAttribute(String(raw.attribute ?? ""));
  return attribute ? [attribute] : [];
}

function normalizeLetterAttributes(raw: CharacterRecord, attributes: string[]): CharacterLetter[] {
  const fallbackLetters = toStringArray(raw.letters).map(normalizeLetter).filter(Boolean);
  const structured = Array.isArray(raw.letterAttributes)
    ? raw.letterAttributes
        .map((item) => ({
          letter: normalizeLetter(String(item.letter ?? "")),
          attributes: toStringArray(item.attributes).map(normalizeAttribute).filter(Boolean),
        }))
        .filter((item) => item.letter)
    : [];

  const allowedAttributes = new Set(attributes);
  const hasOutOfScopeAttribute =
    allowedAttributes.size > 0 &&
    structured.some((item) => item.attributes.some((attribute) => !allowedAttributes.has(attribute)));

  if (hasOutOfScopeAttribute) {
    return fallbackLetters.map((letter) => ({
      letter,
      attributes,
    }));
  }

  if (structured.length > 0) {
    const merged = new Map<string, Set<string>>();
    for (const item of structured) {
      const scopedAttributes = item.attributes.filter((attribute) => !allowedAttributes.size || allowedAttributes.has(attribute));
      const itemAttributes = scopedAttributes.length ? scopedAttributes : attributes;
      merged.set(item.letter, new Set([...(merged.get(item.letter) ?? []), ...itemAttributes]));
    }
    return Array.from(merged.entries()).map(([letter, attrs]) => ({
      letter,
      attributes: Array.from(attrs),
    }));
  }

  return fallbackLetters.map((letter) => ({
    letter,
    attributes,
  }));
}

function allCharacterAttributes(character: CharacterRecord) {
  return unique([
    ...(character.attributes ?? [character.attribute]),
    ...((character.letterAttributes ?? []).flatMap((item) => item.attributes ?? [])),
  ])
    .map(normalizeAttribute)
    .filter(Boolean);
}

function normalizeCharacter(raw: CharacterRecord): CharacterRecord {
  const attributes = normalizeAttributeList(raw);
  const letterAttributes = normalizeLetterAttributes(raw, attributes);
  const letters = letterAttributes.map((item) => item.letter);
  const species = normalizeSpecies(String(raw.species ?? raw.race ?? "不明")) || "不明";
  const rawGimmicks = toStringArray(raw.gimmicks);
  const rawSuperGimmicks = toStringArray(raw.superGimmicks);
  const superGimmicks = normalizeSuperGimmickList([...rawSuperGimmicks, ...rawGimmicks]);
  const normalGimmickSource = rawGimmicks.filter((item) => !normalizeSuperGimmickName(item));

  return {
    ...raw,
    id: String(raw.id ?? ""),
    name: String(raw.name ?? "").trim(),
    attribute: attributes[0] ?? normalizeAttribute(String(raw.attribute ?? "")),
    attributes,
    race: species,
    species,
    letters,
    letterAttributes,
    leaderTraits: unique(toStringArray(raw.leaderTraits)),
    gimmicks: normalizeGimmickList(normalGimmickSource),
    superGimmicks,
    groups: unique(toStringArray(raw.groups)),
    collabGroups: unique(toStringArray(raw.collabGroups)),
    leaderTraitText: String(raw.leaderTraitText ?? "").trim() || undefined,
    normalMove: normalizeMove(raw.normalMove),
    superMove: normalizeMove(raw.superMove),
    kotowaza: normalizeKotowaza(raw.kotowaza),
    traits: normalizeTraitEntries(raw.traits),
    traitsRaw: unique(toStringArray(raw.traitsRaw)),
    rarityType: normalizeRarityType(raw.rarityType),
    rating: String(raw.rating ?? raw.rank ?? "").trim(),
    sourceUrl: String(raw.sourceUrl ?? "").trim(),
    updatedAt: String(raw.updatedAt ?? raw.retrievedAt ?? "").trim(),
    imageUrl: raw.imageUrl ? String(raw.imageUrl).trim() : undefined,
    imageSourceUrl: raw.imageSourceUrl ? String(raw.imageSourceUrl).trim() : undefined,
  };
}

function normalizedKey(character: CharacterRecord) {
  return `${String(character.name ?? "").trim()}::${String(character.sourceUrl ?? "").trim()}`;
}

function toSearchText(
  character: CharacterRecord,
  traitTemplates: TraitTemplate[] = [],
  matchedTraitTemplates: { ids: string[]; names: string[] } = { ids: [], names: [] },
) {
  return normalizeText(
    [
      character.name,
      character.attributes?.join(" ") ?? character.attribute,
      character.species ?? character.race ?? "",
      character.rating,
      character.rank ?? "",
      character.letters.join(" "),
      character.letterAttributes
        ?.map((item) => `${item.letter} ${item.attributes.join(" ")}`)
        .join(" ") ?? "",
      character.leaderTraits?.join(" ") ?? "",
      character.leaderTraitText ?? "",
    character.gimmicks.join(" "),
      character.superGimmicks?.join(" ") ?? "",
      character.exSkill?.name ?? "",
      character.exSkill?.summary ?? "",
      character.exSkill?.effect ?? "",
      character.chargeSkill?.name ?? "",
      character.chargeSkill?.summary ?? "",
      character.chargeSkill?.effect ?? "",
      character.relatedCharacters?.map((item) => `${item.characterId} ${item.memo ?? ""}`).join(" ") ?? "",
      character.relatedCharacterIds?.join(" ") ?? "",
      character.obtainedQuestIds?.join(" ") ?? "",
      character.recommendedQuestIds?.join(" ") ?? "",
      character.groups?.join(" ") ?? "",
      character.collabGroups?.join(" ") ?? "",
      traitSearchText(character.traits, traitTemplates),
      character.traitsRaw?.join(" ") ?? "",
      matchedTraitTemplates.ids.join(" "),
      matchedTraitTemplates.names.join(" "),
      character.rarityType ?? "",
      moveConditionSearchText(character.normalMove),
      moveConditionSearchText(character.superMove),
      kotowazaSearchText(character.kotowaza),
    ].join(" "),
  );
}

function indexCharacters(
  characters: CharacterRecord[],
  traitTemplates: TraitTemplate[] = [],
  traitTemplateMatchIndex: TraitTemplateMatchIndex = new Map(),
): IndexedCharacter[] {
  return characters.map((character) => {
    const matchedTraitTemplates = traitTemplateMatchIndex.get(character.id) ?? { ids: [], names: [] };
    const structuredTraitNames = traitTemplateNames(character.traits ?? [], traitTemplates);
    const traitNames = unique([...structuredTraitNames, ...matchedTraitTemplates.names]);
    return {
      ...character,
      ...partitionDisplayTraits(character, traitTemplates),
      traitNames,
      searchText: toSearchText(character, traitTemplates, matchedTraitTemplates),
      normalizedAttributes: allCharacterAttributes(character),
      normalizedSpecies: [character.species ?? character.race ?? ""].map(speciesSearchCategory).filter(Boolean),
      normalizedLeaderTraits: (character.leaderTraits ?? []).map(normalizeTrait).filter(Boolean),
      normalizedGimmicks: character.gimmicks.map(normalizeGimmick).filter(Boolean),
      normalizedSuperGimmicks: (character.superGimmicks ?? []).map(normalizeGimmick).filter(Boolean),
      normalizedGroups: (character.groups ?? []).map(normalizeText).filter(Boolean),
      normalizedCollabGroups: (character.collabGroups ?? []).map(normalizeText).filter(Boolean),
      normalizedLetters: character.letters.map(normalizeLetter).filter(Boolean),
      normalizedTraits: [
        ...matchedTraitTemplates.ids,
        ...matchedTraitTemplates.names,
        ...(character.traits ?? []).flatMap((trait) => {
          if (typeof trait === "string") {
            return [trait];
          }
          const template = traitTemplates.find((item) => item.id === trait.templateId);
          return [trait.templateId, template?.name ?? ""];
        }),
      ]
        .map(normalizeText)
        .filter(Boolean),
      normalizedRarityType: character.rarityType ? [normalizeText(character.rarityType)] : [],
    };
  });
}

function mergeCharacters(autoCharacters: CharacterRecord[], manualCharacters: Partial<CharacterRecord>[]) {
  const merged = new Map<string, CharacterRecord>();
  const idToKey = new Map<string, string>();

  for (const character of autoCharacters) {
    const key = normalizedKey(character);
    merged.set(key, character);
    if (character.id) {
      idToKey.set(character.id, key);
    }
  }

  for (const character of manualCharacters) {
    const key = character.id && idToKey.has(character.id) ? idToKey.get(character.id)! : normalizedKey(character as CharacterRecord);
    const existing = merged.get(key);
    const next = normalizeCharacter({
      ...(existing ?? character),
      ...character,
      attributes: character.attributes?.length ? character.attributes : existing?.attributes,
      species: character.species && character.species !== "不明" ? character.species : existing?.species,
      race: character.race && character.race !== "不明" ? character.race : existing?.race,
      letters: manualArray<string>(character, "letters", existing?.letters),
      letterAttributes: manualArray<CharacterLetter>(character, "letterAttributes", existing?.letterAttributes),
      leaderTraits: manualArray<string>(character, "leaderTraits", existing?.leaderTraits),
      gimmicks: manualArray<string>(character, "gimmicks", existing?.gimmicks),
      superGimmicks: manualArray<string>(character, "superGimmicks", existing?.superGimmicks),
      groups: unique([...(existing?.groups ?? []), ...manualArray<string>(character, "groups", [])]),
      collabGroups: unique([...(existing?.collabGroups ?? []), ...manualArray<string>(character, "collabGroups", [])]),
      imageUrl: character.imageUrl ?? existing?.imageUrl,
      imageSourceUrl: character.imageSourceUrl ?? existing?.imageSourceUrl,
      memo: character.memo ?? existing?.memo,
      review: character.review ?? existing?.review,
      recommendedQuests: manualArray<string>(character, "recommendedQuests", existing?.recommendedQuests),
      adminMemo: character.adminMemo ?? existing?.adminMemo,
      leaderTraitText: character.leaderTraitText ?? existing?.leaderTraitText,
      normalMove: character.normalMove ?? existing?.normalMove,
      superMove: character.superMove ?? existing?.superMove,
      exSkill: character.exSkill ?? existing?.exSkill,
      chargeSkill: character.chargeSkill ?? existing?.chargeSkill,
      kotowaza: manualArray(character, "kotowaza", existing?.kotowaza),
      traits: manualArray(character, "traits", existing?.traits),
      traitsRaw: manualArray<string>(character, "traitsRaw", existing?.traitsRaw),
      relatedCharacters: manualArray(character, "relatedCharacters", existing?.relatedCharacters),
      relatedCharacterIds: manualArray<string>(character, "relatedCharacterIds", existing?.relatedCharacterIds),
      obtainedQuestIds: manualArray<string>(character, "obtainedQuestIds", existing?.obtainedQuestIds),
      recommendedQuestIds: manualArray<string>(character, "recommendedQuestIds", existing?.recommendedQuestIds),
      rarityType: character.rarityType ?? existing?.rarityType,
      updatedByManual: true,
    } as CharacterRecord);
    merged.set(key, next);
    if (next.id) {
      idToKey.set(next.id, key);
    }
  }

  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

function anyMatch(values: string[], selected: string[], normalizer: (value: string) => string) {
  if (!selected.length) {
    return false;
  }
  const normalizedSelected = selected.map(normalizer).filter(Boolean);
  return normalizedSelected.some((item) => values.some((value) => value.includes(item)));
}

function allMatch(values: string[], selected: string[], normalizer: (value: string) => string) {
  if (!selected.length) {
    return true;
  }
  const normalizedSelected = selected.map(normalizer).filter(Boolean);
  return normalizedSelected.every((item) => values.some((value) => value.includes(item)));
}

function anyExactMatch(values: string[], selected: string[], normalizer: (value: string) => string) {
  if (!selected.length) {
    return false;
  }
  const normalizedValues = new Set(values.map(normalizer).filter(Boolean));
  return selected.map(normalizer).filter(Boolean).some((item) => normalizedValues.has(item));
}

function allExactMatch(values: string[], selected: string[], normalizer: (value: string) => string) {
  if (!selected.length) {
    return true;
  }
  const normalizedValues = new Set(values.map(normalizer).filter(Boolean));
  return selected.map(normalizer).filter(Boolean).every((item) => normalizedValues.has(item));
}

function hasAnyFilter(filters: CharacterSearchFilters) {
  return Boolean(
    filters.attributes?.length ||
      filters.species?.length ||
      filters.leaderTraits?.length ||
      filters.gimmicks?.length ||
      filters.superGimmicks?.length ||
      filters.groups?.length ||
      filters.traits?.length ||
      filters.rarityTypes?.length ||
      filters.letters?.length,
  );
}

function characterMatchesFilters(character: IndexedCharacter, filters: CharacterSearchFilters = {}) {
  const mode: CharacterSearchMatchMode = filters.matchMode ?? "or";
  const letterMode: CharacterSearchMatchMode = filters.letterMatchMode ?? "or";
  const lettersMatched =
    letterMode === "and"
      ? allMatch(character.normalizedLetters, filters.letters ?? [], normalizeLetter)
      : anyMatch(character.normalizedLetters, filters.letters ?? [], normalizeLetter);

  if (mode === "and") {
    return (
      allMatch(character.normalizedAttributes, filters.attributes ?? [], normalizeAttribute) &&
      allMatch(character.normalizedSpecies, filters.species ?? [], speciesSearchCategory) &&
      allMatch(character.normalizedLeaderTraits, filters.leaderTraits ?? [], normalizeTrait) &&
      allMatch(character.normalizedGimmicks, filters.gimmicks ?? [], normalizeGimmick) &&
      allMatch(character.normalizedSuperGimmicks, filters.superGimmicks ?? [], normalizeGimmick) &&
      allMatch(
        unique([...character.normalizedGroups, ...character.normalizedCollabGroups]),
        filters.groups ?? [],
        normalizeText,
      ) &&
      allExactMatch(character.normalizedTraits, filters.traits ?? [], normalizeText) &&
      allMatch(character.normalizedRarityType, filters.rarityTypes ?? [], normalizeText) &&
      (filters.letters?.length ? lettersMatched : true)
    );
  }

  if (!hasAnyFilter(filters)) {
    return true;
  }

  return (
    anyMatch(character.normalizedAttributes, filters.attributes ?? [], normalizeAttribute) ||
    anyMatch(character.normalizedSpecies, filters.species ?? [], speciesSearchCategory) ||
    anyMatch(character.normalizedLeaderTraits, filters.leaderTraits ?? [], normalizeTrait) ||
    anyMatch(character.normalizedGimmicks, filters.gimmicks ?? [], normalizeGimmick) ||
    anyMatch(character.normalizedSuperGimmicks, filters.superGimmicks ?? [], normalizeGimmick) ||
    anyMatch(
      unique([...character.normalizedGroups, ...character.normalizedCollabGroups]),
      filters.groups ?? [],
      normalizeText,
    ) ||
    anyExactMatch(character.normalizedTraits, filters.traits ?? [], normalizeText) ||
    anyMatch(character.normalizedRarityType, filters.rarityTypes ?? [], normalizeText) ||
    lettersMatched
  );
}

function toSearchResult(character: CharacterRecord): CharacterSearchResult {
  return publicCharacterFields({
    id: character.id,
    name: character.name,
    attribute: character.attribute,
    attributes: character.attributes ?? [],
    race: character.race,
    species: character.species,
    letters: character.letters,
    letterAttributes: character.letterAttributes ?? [],
    leaderTraits: character.leaderTraits ?? [],
    gimmicks: character.gimmicks,
    superGimmicks: character.superGimmicks ?? [],
    groups: character.groups ?? [],
    collabGroups: character.collabGroups ?? [],
    sourceUrl: character.sourceUrl,
    imageUrl: character.imageUrl,
    imageSourceUrl: character.imageSourceUrl,
    memo: character.memo,
    review: character.review,
    recommendedQuests: character.recommendedQuests,
    adminMemo: character.adminMemo,
    leaderTraitText: character.leaderTraitText,
    normalMove: character.normalMove,
    superMove: character.superMove,
    exSkill: character.exSkill,
    chargeSkill: character.chargeSkill,
    kotowaza: character.kotowaza,
    traits: character.traits,
    traitsRaw: character.traitsRaw,
    blessingTraitsRaw: character.blessingTraitsRaw,
    renderedTraits: character.renderedTraits,
    renderedBlessingTraits: character.renderedBlessingTraits,
    status: character.status,
    traitNames: character.traitNames,
    rarityType: character.rarityType,
    relatedCharacters: character.relatedCharacters,
    relatedCharacterIds: character.relatedCharacterIds,
    obtainedQuestIds: character.obtainedQuestIds,
    recommendedQuestIds: character.recommendedQuestIds,
  });
}

async function buildCache(): Promise<CharacterCache> {
  const signature = await dataSignature();
  const [autoData, manualData] = await Promise.all([
    readCharacterFile(AUTO_PATH, { normalize: false }),
    readCharacterFile(MANUAL_PATH, { normalize: false }),
  ]);
  const autoRawCharacters = (autoData.characters ?? []) as CharacterRecord[];
  const autoCharacters = autoRawCharacters.map(normalizeCharacter);
  const manualCharacters = manualData.characters ?? [];
  const [groupOrder, traitMaster, traitTemplateMatchIndex, newTraitMatches, reviewedTraitSources, recoveries] = await Promise.all([
    readGroupOrder(),
    readTraitMaster(),
    readTraitTemplateMatchIndex(),
    readNewTraitMatches(),
    readFile(REVIEWED_TRAIT_SOURCES_PATH, "utf8").then(text => parseReviewedTraitSearchSources(JSON.parse(text))),
    readFile(DETAIL_RECOVERY_PATH, "utf8").then(text => parseCharacterDetailRecoveries(JSON.parse(text))).catch(error => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }),
  ]);
  const collabGroupOrderEntries = [...groupOrder.collabGroups, ...EXTRA_COLLAB_GROUPS];
  // Recovering prose must not reclassify existing group metadata.
  const groupedCharacters = applyInferredCollabGroups(mergeCharacters(autoCharacters, manualCharacters), collabGroupOrderEntries);
  const mergedCharacters = applyCharacterDetailRecoveries(groupedCharacters, recoveries, manualCharacters).characters;
  const effectiveTraitIndex = supplementTraitMatchIndex(traitTemplateMatchIndex, newTraitMatches, mergedCharacters, traitMaster.templates);
  const characters = indexCharacters(mergedCharacters, traitMaster.templates, effectiveTraitIndex);
  const traitSearch = buildTraitSearchIndex(autoRawCharacters, manualCharacters, traitMaster.templates, reviewedTraitSources, recoveries);
  const groupDisplayMap = getGroupDisplayMap(groupOrder);
  const groupOptions = sortGroupsByOrder(
    unique([...groupOrder.groups.map((entry) => entry.name), ...characters.flatMap((character) => character.groups ?? [])]),
    groupOrder.groups,
    "groups",
  );
  const collabGroupOptions = sortGroupsByOrder(
    unique([...collabEntryNames(collabGroupOrderEntries), ...characters.flatMap((character) => character.collabGroups ?? [])]),
    collabGroupOrderEntries,
    "collabGroups",
  );
  const traitOptions = unique([...effectiveTraitIndex.values()].flatMap((entry) => entry.names)).sort((a, b) =>
    a.localeCompare(b, "ja"),
  );
  const rarityTypeOptions = sortRarityTypes(unique([...SPECIAL_RARITY_TYPES, ...characters.flatMap((character) => character.rarityType ? [character.rarityType] : [])]));
  const superGimmickOptions = unique(characters.flatMap((character) => character.superGimmicks ?? [])).sort((a, b) =>
    a.localeCompare(b, "ja"),
  );

  return {
    characters,
    traitSearchIndex: indexTraitSearchEvidence(traitSearch),
    signature,
    meta: {
      autoPath: "data/characters.json",
      manualPath: "data/characters.manual.json",
      totalAuto: autoCharacters.length,
      totalManual: manualCharacters.length,
      totalCharacters: characters.length,
      generatedAt: autoData.meta?.generatedAt ?? autoData.meta?.updatedAt ?? null,
      policy: autoData.meta?.policy ?? POLICY,
      groupOptions: unique([...groupOptions, ...collabGroupOptions]),
      collabGroupOptions,
      groupDisplayNames: groupDisplayMap.groups,
      collabGroupDisplayNames: groupDisplayMap.collabGroups,
      groupOrderPath: "data/groupOrder.json",
      traitOptions,
      traitNameOptions: traitSearch.names,
      traitCategoryOptions: traitSearch.categories,
      rarityTypeOptions,
      superGimmickOptions,
    },
  };
}

export async function getCharacterCache(refresh = false): Promise<CharacterCache> {
  const currentSignature = await dataSignature();
  if (refresh || (cache && cache.signature !== currentSignature)) {
    cache = null;
    cachePromise = null;
  }
  if (cache) {
    return cache;
  }
  cachePromise ??= buildCache();
  cache = await cachePromise;
  cachePromise = null;
  return cache;
}

export async function getCharacterMeta(refresh = false) {
  const current = await getCharacterCache(refresh);
  return current.meta;
}

export async function searchCharacterCache(
  query: string,
  limit = SEARCH_LIMIT,
  refresh = false,
  filters: CharacterSearchFilters = {},
) {
  const current = await getCharacterCache(refresh);
  const normalizedQuery = normalizeText(query.trim());
  const matchMode = filters.matchMode ?? "or";
  const letterMatchMode = filters.letterMatchMode ?? "or";
  const matched = current.characters.filter((character) => {
    const textMatched = normalizedQuery ? character.searchText.includes(normalizedQuery) : true;
    return textMatched && characterMatchesFilters(character, filters) && matchesTraitSearch(current.traitSearchIndex.get(character.id), filters.traitNames, filters.traitCategories, filters.traitMatchMode, filters.traitSource);
  });

  return {
    query,
    results: matched.slice(0, limit).map(toSearchResult),
    totalMatches: matched.length,
    limit,
    matchMode,
    letterMatchMode,
  };
}

export async function getCharacterById(id: string, refresh = false) {
  const current = await getCharacterCache(refresh);
  const decodedId = decodeURIComponent(id);
  const character = current.characters.find((item) => item.id === decodedId);
  return character ? toSearchResult(character) : null;
}

export function clearCharacterCache() {
  cache = null;
  cachePromise = null;
}
