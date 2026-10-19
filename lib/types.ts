import type { TraitSearchOption, TraitSearchSource } from "./traitSearch";

export type CharacterLetter = {
  letter: string;
  attributes: string[];
};

export type DeckCharacter = {
  id: number;
  letters: string[];
  letterAttributes?: CharacterLetter[];
  name?: string;
  attribute?: string;
  attributes?: string[];
  race?: string;
  species?: string;
  leaderTraits?: string[];
  gimmicks?: string[];
  groups?: string[];
  collabGroups?: string[];
  sourceUrl?: string;
  imageUrl?: string;
  imageSourceUrl?: string;
};

export type CharacterRecord = {
  id: string;
  name: string;
  attribute: string;
  attributes?: string[];
  race?: string;
  species?: string;
  letters: string[];
  letterAttributes?: CharacterLetter[];
  leaderTraits?: string[];
  gimmicks: string[];
  groups?: string[];
  collabGroups?: string[];
  rating: string;
  sourceUrl: string;
  updatedAt: string;
  imageUrl?: string;
  imageSourceUrl?: string;
  memo?: string;
  review?: string;
  recommendedQuests?: string[];
  adminMemo?: string;
  leaderTraitText?: string;
  normalMove?: CharacterMove;
  superMove?: CharacterMove;
  exSkill?: CharacterSkill;
  chargeSkill?: CharacterSkill;
  kotowaza?: CharacterKotowaza[];
  traits?: CharacterTraitEntry[];
  traitsRaw?: string[];
  blessingTraitsRaw?: string[];
  status?: CharacterStatus;
  renderedTraits?: string[];
  renderedBlessingTraits?: string[];
  traitNames?: string[];
  rarityType?: CharacterRarityType;
  superGimmicks?: string[];
  relatedCharacters?: RelatedCharacter[];
  relatedCharacterIds?: string[];
  obtainedQuestIds?: string[];
  recommendedQuestIds?: string[];
  rank?: string;
  retrievedAt?: string;
  updatedByManual?: boolean;
};

export type TraitParamType = "text" | "number" | "attribute" | "species" | "letter" | "gimmick" | "condition";

export type TraitTemplateParam = {
  key: string;
  label: string;
  type: TraitParamType;
  required?: boolean;
};

export type TraitTemplate = {
  id: string;
  name: string;
  template: string;
  params: TraitTemplateParam[];
  category?: string;
  sourceType?: "trait" | "blessingTrait";
  pattern?: string;
  paramKeys?: string[];
  examples?: string[];
  description?: string;
  isActive?: boolean;
};

export type TraitMasterFile = {
  meta?: {
    updatedAt?: string | null;
  };
  templates: TraitTemplate[];
};

export type CharacterTrait = {
  templateId: string;
  values?: Record<string, string | number>;
  note?: string;
};

export type CharacterTraitEntry = string | CharacterTrait;

export type CharacterSkill = {
  name?: string;
  summary?: string;
  effect?: string;
};

export type CharacterStatus = {
  hp?: number;
  atk?: number;
  maxHp?: number;
  maxAtk?: number;
  blessedHp?: number;
  blessedAtk?: number;
  raw?: string[];
};

export type CharacterDetailCandidate = {
  characterId: string;
  name: string;
  sourceUrl?: string;
  currentLetters?: string[];
  extractedLetters?: string[];
  currentLetterAttributes?: CharacterLetter[];
  extractedLetterAttributes?: CharacterLetter[];
  missingVoicedLetters?: string[];
  letterWarnings?: string[];
  leaderTraitText?: string;
  normalMove?: CharacterMove;
  superMove?: CharacterMove;
  moveWarnings?: string[];
  traitsRaw?: string[];
  blessingTraitsRaw?: string[];
  status?: CharacterStatus;
  exSkill?: CharacterSkill;
  chargeSkill?: CharacterSkill;
  rawSections?: Array<{
    title: string;
    text: string;
  }>;
  extractedAt: string;
};

export type RelatedCharacter = {
  characterId: string;
  memo?: string;
};

export type MoveCondition =
  | { type: "combo"; comboCount: number }
  | { type: "theme"; theme: string }
  | { type: "minLetters"; count: 4 | 5 | 6 }
  | { type: "startsWithOwnLetter4" }
  | { type: "endsWithOwnLetter4" };

export type CharacterMove = {
  /** Legacy free-text condition. Kept for existing manual data compatibility. */
  condition?: string;
  conditions?: MoveCondition[];
  effect?: string;
};

export type CharacterKotowaza = {
  level: 0 | 1 | 2 | 3 | 4;
  /** Legacy free-text condition. Kept for existing manual data compatibility. */
  condition?: string;
  conditions?: MoveCondition[];
  effect?: string;
};

export type CharacterRarityType = "スペシャル" | "レジェンド" | "グランド" | "ミラクル" | "ドリーム" | "";

export type RarityCandidateConfidence = "high" | "low";

export type SpecialRaritySourceUrl = {
  url: string;
  memo?: string;
};

export type SpecialRarityCandidate = {
  characterId: string;
  name: string;
  currentRarityType?: CharacterRarityType;
  candidateRarityType: Exclude<CharacterRarityType, "">;
  matchedSourceUrl: string;
  matchedSectionTitle?: string;
  sourceMemo?: string;
  matchedText: string;
  confidence: RarityCandidateConfidence;
  matchReason: string;
  status?: "pending" | "applied" | "excluded";
  updatedAt?: string;
};

export type CharacterSearchResult = Pick<
  CharacterRecord,
  | "id"
  | "name"
  | "attribute"
  | "attributes"
  | "race"
  | "species"
  | "letters"
  | "letterAttributes"
  | "leaderTraits"
  | "gimmicks"
  | "groups"
  | "collabGroups"
  | "sourceUrl"
  | "imageUrl"
  | "imageSourceUrl"
  | "memo"
  | "review"
  | "recommendedQuests"
  | "leaderTraitText"
  | "normalMove"
  | "superMove"
  | "exSkill"
  | "chargeSkill"
  | "kotowaza"
  | "traits"
  | "traitsRaw"
  | "blessingTraitsRaw"
  | "status"
  | "renderedTraits"
  | "renderedBlessingTraits"
  | "traitNames"
  | "rarityType"
  | "superGimmicks"
  | "relatedCharacters"
  | "relatedCharacterIds"
  | "obtainedQuestIds"
  | "recommendedQuestIds"
>;

export type CharacterDataMeta = {
  autoPath: string;
  manualPath: string;
  totalAuto: number;
  totalManual: number;
  totalCharacters: number;
  generatedAt: string | null;
  policy: string;
  groupOptions?: string[];
  collabGroupOptions?: string[];
  groupDisplayNames?: Record<string, string>;
  collabGroupDisplayNames?: Record<string, string>;
  groupOrderPath?: string;
  traitOptions?: string[];
  traitNameOptions?: TraitSearchOption[];
  traitCategoryOptions?: TraitSearchOption[];
  rarityTypeOptions?: string[];
  superGimmickOptions?: string[];
};

export type CharacterLoadResult = {
  characters: CharacterRecord[];
  meta: CharacterDataMeta;
};

export type CharacterMetaResult = {
  meta: CharacterDataMeta;
};

export type CharacterSearchResponse = {
  query: string;
  results: CharacterSearchResult[];
  totalMatches: number;
  limit: number;
  matchMode: CharacterSearchMatchMode;
  letterMatchMode: CharacterSearchMatchMode;
};

export type CharacterSearchMatchMode = "or" | "and";

export type CharacterSearchFilters = {
  attributes?: string[];
  species?: string[];
  leaderTraits?: string[];
  gimmicks?: string[];
  superGimmicks?: string[];
  groups?: string[];
  letters?: string[];
  traits?: string[];
  traitNames?: string[];
  traitCategories?: string[];
  traitSource?: TraitSearchSource;
  traitMatchMode?: CharacterSearchMatchMode;
  rarityTypes?: string[];
  matchMode?: CharacterSearchMatchMode;
  letterMatchMode?: CharacterSearchMatchMode;
};

export type QuestRecord = {
  questId: string;
  questName: string;
  id?: string;
  name?: string;
  type?: string;
  questType?: string;
  enemyAttribute?: string;
  enemyAttributes?: string[];
  difficulty?: string;
  difficulties?: string[];
  statusAilments?: string[];
  gimmicks?: string[];
  hazards?: string[];
  obtainableCharacterIds?: string[];
  clearRewards?: string[];
  bestLeaderIds?: string[];
  recommendedLeaderIds?: string[];
  bestSubCharacters?: QuestCharacterRecommendation[];
  recommendedSubCharacters?: QuestCharacterRecommendation[];
  boardPatterns?: string[];
  strategyText?: string;
  sourceUrl?: string;
  memo?: string;
  updatedAt?: string;
};

export type QuestCharacterRecommendation = {
  characterId: string;
  role?: string;
  memo?: string;
};

export type QuestFile = {
  meta?: {
    updatedAt?: string | null;
  };
  quests: QuestRecord[];
};

export type ArticleType = "quest_guide" | "character_review" | "deck_guide" | "beginner_guide" | "event_summary";

export type ArticleStatus = "draft" | "published" | "archived";

export type ArticleBlockType =
  | "paragraph"
  | "point"
  | "warning"
  | "questInfoTable"
  | "characterList"
  | "deckExample"
  | "boardPattern"
  | "wordExamples"
  | "image"
  | "characterCard"
  | "collapse"
  | "table";
export type RichTextNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: RichTextNode[];
};
export type RichTextDocument = { type: "doc"; content: RichTextNode[] };
export type ArticleImage = { src: string; alt: string; width?: number; height?: number; caption?: string; widthPercent?: number; mobileWidthPercent?: number; align?: "left" | "center" | "right"; href?: string };

export type ArticleBlock = {
  id: string;
  type: ArticleBlockType;
  content: string;
  richText?: RichTextDocument;
  image?: ArticleImage;
  characterIds?: string[];
  spacing?: number;
  align?: "left" | "center" | "right";
  collapseTitle?: string;
};

export type ArticleSection = {
  id: string;
  heading: string;
  hideHeading?: boolean;
  questSection?: QuestArticleSectionKey;
  questWave?: { id: string; target: "points" | "notes" };
  blocks: ArticleBlock[];
};

export type QuestArticleSectionKey = "overview" | "hazards" | "points" | "boards" | "bombs" | "characters" | "teams" | "phases" | "notes";
export type QuestReviewKey = "overview" | "enemies" | "gimmicks" | "ailments" | "boards" | "bombs" | "characters" | "teams" | "phases";
export type QuestReviewState = "unconfirmed" | "confirmed" | "none";
export type QuestArticleAxis = "i" | "u" | "smallKana" | "any";
export type QuestArticleEnemy = { id: string; name: string; role: "boss" | "mob"; attributes: string[]; species: string[]; hp: string; note: string };
export type QuestArticleMechanic = {
  id: string; name: string; category: "gimmick" | "ailment" | "barrier" | "field" | "other";
  occurrence: "present" | "absent" | "unknown"; importance: "required" | "recommended" | "unnecessary" | "unknown";
  counterTrait: string; counterTags: string[]; count?: number; durability: string; wave: string; turn: string; note: string; icon?: ArticleImage;
};
export type QuestArticleBomb = {
  id: string; kind: string; timing: string; turnLimit?: number;
  condition: { minWordLength?: number; requiredCount?: number; theme: string; text: string };
  success: string; failure: string; method: string;
};
export type QuestArticleBoard = {
  id: string; label: string; pattern: string; wave: string; turn: string; phase: string;
  words: string[]; behavior: string; image?: ArticleImage; display?: "both" | "image" | "pattern";
};
export type QuestArticlePhase = { id: string; name: string; wave: string; turn: string; trigger: string; actions: string; mechanicIds: string[]; turnLimit?: number; response: string };
export type QuestArticleRecommendation = { id: string; characterId: string; role: "leader" | "sub"; reason: string; confirmed: boolean };
export type QuestArticleTeam = { id: string; name: string; slots: Array<string | null>; note: string };
export type QuestArticleDrop = { id: string; kind: "character" | "item"; characterId: string; name: string; condition: string; image?: ArticleImage };
export type QuestEnemyPosition = "left" | "center" | "right";
export type QuestWaveEnemyPlacement = { enemyId: string; position: QuestEnemyPosition | "unknown" };
export type QuestArticleWave = {
  id: string; name: string; mechanicIds: string[]; boardIds: string[]; bombIds: string[]; phaseIds: string[]; hazardsState?: QuestReviewState;
  enemyCount?: 1 | 2 | 3; enemyPlacements?: QuestWaveEnemyPlacement[];
};
export type ArticleQuest = {
  version: 1; name: string; boss: string; difficulty: string; category: string; relatedEventArticleId: string;
  stamina?: number; participation: string; lastCheckedOn: string; sources: string[];
  review: Record<QuestReviewKey, QuestReviewState>;
  enemies: QuestArticleEnemy[]; mechanics: QuestArticleMechanic[]; bombs: QuestArticleBomb[];
  axis: "unknown" | "i" | "u" | "mixed" | "other"; axes?: QuestArticleAxis[]; axisNote: string; boards: QuestArticleBoard[];
  phases: QuestArticlePhase[]; recommendations: QuestArticleRecommendation[]; teams: QuestArticleTeam[];
  bossCharacterId?: string; bossImage?: ArticleImage;
  drops?: QuestArticleDrop[]; dropsState?: QuestReviewState; waves?: QuestArticleWave[];
};

export type ArticleEventPeriod = {
  startAt?: string;
  endAt?: string;
  startDate?: string;
  startNote?: string;
  endNote?: string;
  availability?: "limited" | "permanent" | "schedule";
};

export type ArticleEventActivity = {
  id: string;
  name: string;
  kind: "gacha" | "reward" | "quest" | "exchange" | "campaign";
  period: ArticleEventPeriod;
  summary: string;
  characterIds: string[];
  officialUrl: string;
  blocks?: ArticleBlock[];
};

export type ArticleEvent = {
  name: string;
  period?: ArticleEventPeriod;
  activities: ArticleEventActivity[];
  officialUrls: string[];
  lastCheckedOn: string;
  publicationReviewed: boolean;
  history: Array<{ checkedOn: string; note: string }>;
  bannerImageUrl?: string;
  homeOrder?: number;
};

export type Article = {
  id: string;
  title: string;
  type: ArticleType;
  status: ArticleStatus;
  slug?: string;
  summary?: string;
  sections: ArticleSection[];
  createdAt: string;
  updatedAt: string;
  event?: ArticleEvent;
  quest?: ArticleQuest;
  coverImage?: ArticleImage;
  toc?: boolean;
  editHistory?: Array<{ at: string; note: string }>;
  contentReviewed?: boolean;
  publishedOn?: string;
};

export type ArticleFile = {
  meta?: {
    updatedAt?: string | null;
  };
  articles: Article[];
};

export type ArticleTemplateBlock = {
  type: ArticleBlockType;
  content: string;
};

export type ArticleTemplateSection = {
  id: string;
  heading: string;
  defaultBlocks: ArticleTemplateBlock[];
  allowedBlockTypes: ArticleBlockType[];
};

export type ArticleTemplate = {
  id: string;
  type: ArticleType;
  label: string;
  sections: ArticleTemplateSection[];
};

export type ArticleTemplateFile = {
  meta?: {
    updatedAt?: string | null;
  };
  templates: ArticleTemplate[];
};
