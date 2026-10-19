"use client";

import { ImageOff, Plus, RotateCcw, Save, Search, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SpecialRarityBadge } from "@/components/SpecialRarityBadge";
import { searchCharacters } from "@/lib/characters";
import {
  COMBINED_GIMMICK_OPTIONS,
  isSuperGimmickDisplayName,
  normalizeGimmickList,
  normalizeSuperGimmickList,
  superGimmickDisplayName,
  superGimmickValueFromDisplay,
} from "@/lib/gimmicks";
import { SPECIAL_RARITY_TYPES } from "@/lib/rarity";
import { normalizeTraitEntries, renderTrait } from "@/lib/traits";
import type {
  CharacterKotowaza,
  CharacterLetter,
  CharacterMove,
  CharacterRarityType,
  CharacterRecord,
  CharacterSearchResult,
  CharacterSkill,
  CharacterTrait,
  CharacterTraitEntry,
  MoveCondition,
  QuestFile,
  QuestRecord,
  RelatedCharacter,
  TraitTemplate,
  TraitTemplateParam,
} from "@/lib/types";

const ATTRIBUTES = ["火", "水", "木", "光", "闇", "冥", "天", "虹"];
const SPECIES = ["神", "英", "龍", "物", "獣", "霊", "魔", "妖", "不明"];
const LEADER_TRAITS = ["毒耐性", "混乱耐性", "睡眠耐性", "呪い耐性", "汚染耐性", "炎上耐性", "改造耐性", "衰弱耐性", "変異耐性", "消去耐性"];
const RARITY_TYPES = ["", ...SPECIAL_RARITY_TYPES];
const KOTOWAZA_LEVELS = [0, 1, 2, 3, 4] as const;
const KANA_ROWS: Array<Array<string | null>> = [
  ["あ", "い", "う", "え", "お"],
  ["か", "き", "く", "け", "こ"],
  ["さ", "し", "す", "せ", "そ"],
  ["た", "ち", "つ", "て", "と"],
  ["な", "に", "ぬ", "ね", "の"],
  ["は", "ひ", "ふ", "へ", "ほ"],
  ["ま", "み", "む", "め", "も"],
  ["や", null, "ゆ", null, "よ"],
  ["ら", "り", "る", "れ", "ろ"],
  ["わ", null, null, null, "ん"],
];
const SMALL_KANA_ROWS: Array<Array<string | null>> = [
  ["ぁ", "ぃ", "ぅ", "ぇ", "ぉ"],
  ["ゃ", null, "ゅ", null, "ょ"],
  ["っ", null, null, null, null],
];
const LETTER_OPTIONS = [...KANA_ROWS, ...SMALL_KANA_ROWS].flat().filter((letter): letter is string => Boolean(letter));

type AdminCharacterForm = Pick<
  CharacterRecord,
  | "id"
  | "name"
  | "attribute"
  | "attributes"
  | "species"
  | "race"
  | "letters"
  | "letterAttributes"
  | "leaderTraits"
  | "gimmicks"
  | "superGimmicks"
  | "groups"
  | "collabGroups"
  | "rating"
  | "sourceUrl"
  | "updatedAt"
  | "imageUrl"
  | "imageSourceUrl"
  | "memo"
  | "review"
  | "recommendedQuests"
  | "adminMemo"
  | "leaderTraitText"
  | "normalMove"
  | "superMove"
  | "exSkill"
  | "chargeSkill"
  | "kotowaza"
  | "traits"
  | "rarityType"
  | "relatedCharacters"
  | "relatedCharacterIds"
  | "obtainedQuestIds"
  | "recommendedQuestIds"
>;

function emptyCharacter(): AdminCharacterForm {
  return {
    id: "",
    name: "",
    attribute: "",
    attributes: [],
    species: "不明",
    race: "不明",
    letters: [],
    letterAttributes: [],
    leaderTraits: [],
    gimmicks: [],
    superGimmicks: [],
    groups: [],
    collabGroups: [],
    rating: "",
    sourceUrl: "",
    updatedAt: "",
    imageUrl: "",
    imageSourceUrl: "",
    memo: "",
    review: "",
    recommendedQuests: [],
    adminMemo: "",
    leaderTraitText: "",
    normalMove: { condition: "", conditions: [], effect: "" },
    superMove: { condition: "", conditions: [], effect: "" },
    exSkill: { name: "", summary: "", effect: "" },
    chargeSkill: { name: "", summary: "", effect: "" },
    kotowaza: [],
    traits: [],
    rarityType: "",
    relatedCharacters: [],
    relatedCharacterIds: [],
    obtainedQuestIds: [],
    recommendedQuestIds: [],
  };
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function toggle(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function attrClass(attribute?: string) {
  if (attribute === "火") return "attr-fire";
  if (attribute === "水") return "attr-water";
  if (attribute === "木") return "attr-wood";
  if (attribute === "光") return "attr-light";
  if (attribute === "闇") return "attr-dark";
  if (attribute === "冥") return "attr-nether";
  if (attribute === "天") return "attr-sky";
  if (attribute === "虹") return "attr-rainbow";
  return "attr-unknown";
}

function asForm(character: CharacterSearchResult | CharacterRecord, collabGroupOptions: string[] = []): AdminCharacterForm {
  const attributes = unique(character.attributes?.length ? character.attributes : character.attribute ? [character.attribute] : []);
  const letters = unique(character.letters ?? []);
  const collabSet = new Set(collabGroupOptions);
  const rawGroups = unique(character.groups ?? []);
  const rawCollabGroups = unique(character.collabGroups ?? []);
  const groups = rawGroups.filter((group) => !collabSet.has(group));
  const collabGroups = unique([
    ...rawCollabGroups,
    ...rawGroups.filter((group) => collabSet.has(group)),
  ]);
  return {
    ...emptyCharacter(),
    ...character,
    attribute: attributes[0] ?? "",
    attributes,
    species: character.species ?? character.race ?? "不明",
    race: character.species ?? character.race ?? "不明",
    letters,
    letterAttributes: normalizeLetterAttributes(character.letterAttributes, letters, attributes),
    leaderTraits: unique(character.leaderTraits ?? []),
    gimmicks: normalizeGimmickList(character.gimmicks ?? []),
    superGimmicks: normalizeSuperGimmickList(character.superGimmicks ?? []),
    groups,
    collabGroups,
    imageUrl: character.imageUrl ?? "",
    imageSourceUrl: character.imageSourceUrl ?? character.sourceUrl ?? "",
    review: typeof character.review === "string" ? character.review : "",
    recommendedQuests: unique(character.recommendedQuests ?? []),
    adminMemo: ("adminMemo" in character ? character.adminMemo : undefined) ?? character.memo ?? "",
    leaderTraitText: character.leaderTraitText ?? "",
    normalMove: character.normalMove ?? { condition: "", conditions: [], effect: "" },
    superMove: character.superMove ?? { condition: "", conditions: [], effect: "" },
    exSkill: character.exSkill ?? { name: "", summary: "", effect: "" },
    chargeSkill: character.chargeSkill ?? { name: "", summary: "", effect: "" },
    kotowaza: character.kotowaza ?? [],
    traits: normalizeTraitEntries(character.traits),
    rarityType: character.rarityType ?? "",
    relatedCharacters: normalizeRelatedCharacters(character.relatedCharacters),
    relatedCharacterIds: unique(character.relatedCharacterIds ?? []),
    obtainedQuestIds: unique(character.obtainedQuestIds ?? []),
    recommendedQuestIds: unique(character.recommendedQuestIds ?? []),
  };
}

function normalizeRelatedCharacters(values?: RelatedCharacter[]) {
  return (values ?? [])
    .map((item) => ({
      characterId: item.characterId?.trim() ?? "",
      memo: item.memo?.trim() ?? "",
    }))
    .filter((item) => item.characterId);
}

function normalizeLetterAttributes(
  letterAttributes: CharacterLetter[] | undefined,
  letters: string[],
  attributes: string[],
) {
  const byLetter = new Map((letterAttributes ?? []).map((item) => [item.letter, item.attributes ?? []]));
  return letters.map((letter) => ({
    letter,
    attributes: unique(byLetter.get(letter) ?? attributes),
  }));
}

function traitValue(trait: CharacterTrait, param: TraitTemplateParam) {
  const value = trait.values?.[param.key];
  return value === undefined || value === null ? "" : String(value);
}

function updateTraitValue(trait: CharacterTrait, param: TraitTemplateParam, value: string): CharacterTrait {
  return {
    ...trait,
    values: {
      ...(trait.values ?? {}),
      [param.key]: param.type === "number" ? Number(value) || 0 : value,
    },
  };
}

async function requestAdmin(url: string, secret: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-admin-password": secret,
      ...(init.headers ?? {}),
    },
  });
}

function OptionButtons({
  options,
  selected,
  onToggle,
  className,
  getOptionLabel,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  className?: (value: string) => string;
  getOptionLabel?: (value: string) => string;
}) {
  return (
    <div className="admin-option-grid">
      {options.map((option) => (
        <button
          className={`${selected.includes(option) ? "selected" : ""} ${className?.(option) ?? ""}`}
          key={option}
          onClick={() => onToggle(option)}
          type="button"
        >
          {getOptionLabel?.(option) ?? option}
        </button>
      ))}
    </div>
  );
}

function KanaGrid({
  rows,
  selected,
  onToggle,
}: {
  rows: Array<Array<string | null>>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="admin-kana-grid">
      {rows.flatMap((row, rowIndex) =>
        row.map((letter, columnIndex) =>
          letter ? (
            <button
              className={selected.includes(letter) ? "selected" : ""}
              key={letter}
              onClick={() => onToggle(letter)}
              type="button"
            >
              {letter}
            </button>
          ) : (
            <span aria-hidden key={`empty-${rowIndex}-${columnIndex}`} />
          ),
        ),
      )}
    </div>
  );
}

type ConditionAddType =
  | "combo"
  | "theme"
  | "minLetters4"
  | "minLetters5"
  | "minLetters6"
  | "startsWithOwnLetter4"
  | "endsWithOwnLetter4";

const CONDITION_ADD_OPTIONS: Array<{ value: ConditionAddType; label: string }> = [
  { value: "combo", label: "○コンボで発動" },
  { value: "theme", label: "特定テーマのことばで発動" },
  { value: "minLetters4", label: "4文字以上" },
  { value: "minLetters5", label: "5文字以上" },
  { value: "minLetters6", label: "6文字以上" },
  { value: "startsWithOwnLetter4", label: "○から始まる4文字" },
  { value: "endsWithOwnLetter4", label: "○で終わる4文字" },
];

function createMoveCondition(type: ConditionAddType): MoveCondition {
  if (type === "combo") {
    return { type: "combo", comboCount: 4 };
  }
  if (type === "theme") {
    return { type: "theme", theme: "" };
  }
  if (type === "minLetters4") {
    return { type: "minLetters", count: 4 };
  }
  if (type === "minLetters5") {
    return { type: "minLetters", count: 5 };
  }
  if (type === "minLetters6") {
    return { type: "minLetters", count: 6 };
  }
  if (type === "startsWithOwnLetter4") {
    return { type: "startsWithOwnLetter4" };
  }
  return { type: "endsWithOwnLetter4" };
}

function moveConditionLabel(condition: MoveCondition) {
  if (condition.type === "combo") {
    return "コンボ";
  }
  if (condition.type === "theme") {
    return "テーマ";
  }
  if (condition.type === "minLetters") {
    return `${condition.count}文字以上`;
  }
  if (condition.type === "startsWithOwnLetter4") {
    return "○から始まる4文字";
  }
  return "○で終わる4文字";
}

function MoveConditionEditor({
  conditions,
  onChange,
}: {
  conditions: MoveCondition[];
  onChange: (conditions: MoveCondition[]) => void;
}) {
  const [addType, setAddType] = useState<ConditionAddType>("minLetters4");

  function updateCondition(index: number, next: MoveCondition) {
    onChange(conditions.map((condition, currentIndex) => currentIndex === index ? next : condition));
  }

  return (
    <div className="move-condition-editor">
      <div className="move-condition-add">
        <select value={addType} onChange={(event) => setAddType(event.target.value as ConditionAddType)}>
          {CONDITION_ADD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <button type="button" onClick={() => onChange([...conditions, createMoveCondition(addType)])}>
          条件追加
        </button>
      </div>
      {conditions.length ? (
        <div className="move-condition-list">
          {conditions.map((condition, index) => (
            <div className="move-condition-row" key={`${condition.type}-${index}`}>
              <span>{moveConditionLabel(condition)}</span>
              {condition.type === "combo" ? (
                <input
                  min={1}
                  type="number"
                  value={condition.comboCount}
                  onChange={(event) =>
                    updateCondition(index, { type: "combo", comboCount: Number(event.target.value) || 1 })
                  }
                />
              ) : null}
              {condition.type === "theme" ? (
                <input
                  value={condition.theme}
                  placeholder="テーマ名"
                  onChange={(event) => updateCondition(index, { type: "theme", theme: event.target.value })}
                />
              ) : null}
              <button type="button" onClick={() => onChange(conditions.filter((_, currentIndex) => currentIndex !== index))}>
                削除
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">条件未登録</p>
      )}
    </div>
  );
}

function TraitInstanceEditor({
  templates,
  traits,
  onChange,
}: {
  templates: TraitTemplate[];
  traits: CharacterTraitEntry[];
  onChange: (traits: CharacterTraitEntry[]) => void;
}) {
  function updateTrait(index: number, next: CharacterTraitEntry) {
    onChange(traits.map((trait, currentIndex) => currentIndex === index ? next : trait));
  }

  function addTrait() {
    const first = templates[0];
    if (!first) {
      return;
    }
    onChange([...traits, { templateId: first.id, values: {} }]);
  }

  return (
    <div className="trait-instance-editor">
      <div className="actions">
        <button disabled={!templates.length} onClick={addTrait} type="button">
          <Plus size={15} aria-hidden />
          特性を追加
        </button>
      </div>
      {!templates.length ? <p className="muted">特性テンプレートがありません。先に「特性管理」で追加してください。</p> : null}
      {traits.length ? (
        <div className="trait-instance-list">
          {traits.map((trait, index) => {
            if (typeof trait === "string") {
              return (
                <div className="trait-instance-row" key={`${trait}-${index}`}>
                  <span className="tag muted-tag">旧形式</span>
                  <strong>{trait}</strong>
                  <button onClick={() => onChange(traits.filter((_, currentIndex) => currentIndex !== index))} type="button">
                    削除
                  </button>
                </div>
              );
            }
            const template = templates.find((item) => item.id === trait.templateId) ?? templates[0];
            return (
              <div className="trait-instance-row structured" key={`${trait.templateId}-${index}`}>
                <label>
                  テンプレート
                  <select
                    value={trait.templateId}
                    onChange={(event) => updateTrait(index, { templateId: event.target.value, values: {}, note: trait.note })}
                  >
                    {templates.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </label>
                {template?.params.map((param) => (
                  <label key={`${trait.templateId}-${param.key}`}>
                    {param.label}
                    {param.type === "attribute" ? (
                      <select value={traitValue(trait, param)} onChange={(event) => updateTrait(index, updateTraitValue(trait, param, event.target.value))}>
                        <option value="">未選択</option>
                        {ATTRIBUTES.map((attribute) => (
                          <option key={attribute} value={attribute}>{attribute}</option>
                        ))}
                      </select>
                    ) : param.type === "species" ? (
                      <select value={traitValue(trait, param)} onChange={(event) => updateTrait(index, updateTraitValue(trait, param, event.target.value))}>
                        <option value="">未選択</option>
                        {SPECIES.map((species) => (
                          <option key={species} value={species}>{species}</option>
                        ))}
                      </select>
                    ) : param.type === "gimmick" ? (
                      <select value={traitValue(trait, param)} onChange={(event) => updateTrait(index, updateTraitValue(trait, param, event.target.value))}>
                        <option value="">未選択</option>
                        {COMBINED_GIMMICK_OPTIONS.map((gimmick) => (
                          <option key={gimmick} value={gimmick}>{gimmick}</option>
                        ))}
                      </select>
                    ) : param.type === "letter" ? (
                      <select value={traitValue(trait, param)} onChange={(event) => updateTrait(index, updateTraitValue(trait, param, event.target.value))}>
                        <option value="">未選択</option>
                        {LETTER_OPTIONS.map((letter) => (
                          <option key={letter} value={letter}>{letter}</option>
                        ))}
                      </select>
                    ) : param.type === "condition" ? (
                      <textarea
                        value={traitValue(trait, param)}
                        onChange={(event) => updateTrait(index, updateTraitValue(trait, param, event.target.value))}
                      />
                    ) : (
                      <input
                        type={param.type === "number" ? "number" : "text"}
                        value={traitValue(trait, param)}
                        onChange={(event) => updateTrait(index, updateTraitValue(trait, param, event.target.value))}
                      />
                    )}
                  </label>
                ))}
                <label className="wide">
                  メモ
                  <input
                    value={trait.note ?? ""}
                    onChange={(event) => updateTrait(index, { ...trait, note: event.target.value })}
                  />
                </label>
                <p className="status trait-preview">プレビュー: {renderTrait(trait, templates)}</p>
                <button onClick={() => onChange(traits.filter((_, currentIndex) => currentIndex !== index))} type="button">
                  削除
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="muted">特性未登録</p>
      )}
    </div>
  );
}

export function AdminCharactersPanel({ adminPassword }: { adminPassword: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CharacterSearchResult[]>([]);
  const [manualCount, setManualCount] = useState(0);
  const [groupOptions, setGroupOptions] = useState<string[]>([]);
  const [collabGroupOptions, setCollabGroupOptions] = useState<string[]>([]);
  const [groupDisplayNames, setGroupDisplayNames] = useState<Record<string, string>>({});
  const [collabGroupDisplayNames, setCollabGroupDisplayNames] = useState<Record<string, string>>({});
  const [groupInput, setGroupInput] = useState("");
  const [collabGroupInput, setCollabGroupInput] = useState("");
  const [form, setForm] = useState<AdminCharacterForm>(() => emptyCharacter());
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [traitTemplates, setTraitTemplates] = useState<TraitTemplate[]>([]);
  const [questOptions, setQuestOptions] = useState<QuestRecord[]>([]);

  const selectedAttributes = useMemo(() => form.attributes ?? [], [form.attributes]);
  const selectedLetters = useMemo(() => form.letters ?? [], [form.letters]);
  const canSave = form.name.trim().length > 0;

  const letterAttributes = useMemo(
    () => normalizeLetterAttributes(form.letterAttributes, selectedLetters, selectedAttributes),
    [form.letterAttributes, selectedAttributes, selectedLetters],
  );

  async function adminFetch(url: string, init: RequestInit = {}, secret = adminPassword) {
    return requestAdmin(url, secret, init);
  }

  const loadAdminData = useCallback(async (secret: string) => {
    setError("");
    const response = await requestAdmin("/api/admin/characters", secret);
    if (!response.ok) {
      setError(response.status === 401 ? "認証に失敗しました。ADMIN_PASSWORD を確認してください。" : await response.text());
      return;
    }
    const data = await response.json();
    setManualCount(data.total ?? 0);
    const traitResponse = await requestAdmin("/api/admin/traits", secret);
    if (traitResponse.ok) {
      const traitData = (await traitResponse.json()) as { templates?: TraitTemplate[] };
      setTraitTemplates(traitData.templates ?? []);
    }
    const questResponse = await requestAdmin("/api/admin/quests", secret);
    if (questResponse.ok) {
      const questData = (await questResponse.json()) as QuestFile;
      setQuestOptions(questData.quests ?? []);
    }
    const metaResponse = await fetch("/api/characters/meta?refresh=1", { cache: "no-store" });
    if (metaResponse.ok) {
      const metaData = await metaResponse.json();
      const collabOptions = metaData.meta?.collabGroupOptions ?? [];
      const collabSet = new Set(collabOptions);
      const originalOptions = (metaData.meta?.groupOptions ?? []).filter((group: string) => !collabSet.has(group));
      setGroupOptions(originalOptions);
      setCollabGroupOptions(collabOptions);
      setGroupDisplayNames(metaData.meta?.groupDisplayNames ?? {});
      setCollabGroupDisplayNames(metaData.meta?.collabGroupDisplayNames ?? {});
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAdminData(adminPassword);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [adminPassword, loadAdminData]);

  async function runSearch() {
    setIsSearching(true);
    setError("");
    try {
      const response = await searchCharacters(query, 30, { matchMode: "or" });
      setResults(response.results);
      setStatus(`検索結果: ${response.totalMatches.toLocaleString()}件`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "検索に失敗しました。");
    } finally {
      setIsSearching(false);
    }
  }

  function update(next: Partial<AdminCharacterForm>) {
    setForm((current) => ({ ...current, ...next }));
  }

  function editCharacter(character: CharacterSearchResult | CharacterRecord) {
    const next = asForm(character, collabGroupOptions);
    setImageFailed(false);
    setImageUrlInput(next.imageUrl ?? "");
    setUploadedImageUrl(next.imageUrl?.startsWith("/character-images/") ? next.imageUrl : "");
    setSelectedImageFile(null);
    setForm(next);
  }

  function toggleAttribute(attribute: string) {
    const attributes = toggle(selectedAttributes, attribute);
    update({
      attributes,
      attribute: attributes[0] ?? "",
      letterAttributes: normalizeLetterAttributes(form.letterAttributes, selectedLetters, attributes),
    });
  }

  function toggleLetter(letter: string) {
    const letters = toggle(selectedLetters, letter);
    update({
      letters,
      letterAttributes: normalizeLetterAttributes(form.letterAttributes, letters, selectedAttributes),
    });
  }

  function toggleLetterAttribute(letter: string, attribute: string) {
    const next = letterAttributes.map((item) =>
      item.letter === letter
        ? {
            ...item,
            attributes: toggle(item.attributes, attribute),
          }
        : item,
    );
    update({ letterAttributes: next });
  }

  function updateMove(kind: "normalMove" | "superMove", patch: Partial<CharacterMove>) {
    update({
      [kind]: {
        ...(form[kind] ?? {}),
        ...patch,
      },
    });
  }

  function updateSkill(kind: "exSkill" | "chargeSkill", patch: Partial<CharacterSkill>) {
    update({
      [kind]: {
        ...(form[kind] ?? {}),
        ...patch,
      },
    });
  }

  function toggleQuestId(kind: "obtainedQuestIds" | "recommendedQuestIds", questId: string) {
    update({ [kind]: toggle(form[kind] ?? [], questId) });
  }

  function addRelatedCharacter(characterId: string) {
    const current = normalizeRelatedCharacters(form.relatedCharacters);
    if (current.some((item) => item.characterId === characterId)) {
      return;
    }
    update({ relatedCharacters: [...current, { characterId, memo: "" }] });
  }

  function updateRelatedCharacter(characterId: string, patch: Partial<RelatedCharacter>) {
    const next = normalizeRelatedCharacters(form.relatedCharacters).map((item) =>
      item.characterId === characterId ? { ...item, ...patch } : item,
    );
    update({ relatedCharacters: next });
  }

  function removeRelatedCharacter(characterId: string) {
    update({
      relatedCharacters: normalizeRelatedCharacters(form.relatedCharacters).filter((item) => item.characterId !== characterId),
    });
  }

  function updateKotowaza(level: 0 | 1 | 2 | 3 | 4, patch: Partial<CharacterKotowaza>) {
    const current = form.kotowaza ?? [];
    const existing = current.find((item) => item.level === level) ?? { level, condition: "", conditions: [], effect: "" };
    const nextItem = { ...existing, ...patch };
    const next = current.filter((item) => item.level !== level);
    if (nextItem.condition || nextItem.conditions?.length || nextItem.effect) {
      next.push(nextItem);
    }
    update({ kotowaza: next.sort((a, b) => a.level - b.level) });
  }

  function kotowazaItem(level: 0 | 1 | 2 | 3 | 4): CharacterKotowaza {
    return form.kotowaza?.find((item) => item.level === level) ?? { level, condition: "", conditions: [], effect: "" };
  }

  function toggleCombinedGimmick(value: string) {
    if (isSuperGimmickDisplayName(value)) {
      const superValue = superGimmickValueFromDisplay(value);
      update({ superGimmicks: normalizeSuperGimmickList(toggle(form.superGimmicks ?? [], superValue)) });
      return;
    }
    update({ gimmicks: normalizeGimmickList(toggle(form.gimmicks ?? [], value)) });
  }

  async function save() {
    setStatus("");
    setError("");
    const collabSet = new Set(collabGroupOptions);
    const rawGroups = unique(form.groups ?? []);
    const rawCollabGroups = unique(form.collabGroups ?? []);
    const normalizedGroups = rawGroups.filter((group) => !collabSet.has(group));
    const normalizedCollabGroups = unique([
      ...rawCollabGroups,
      ...rawGroups.filter((group) => collabSet.has(group)),
    ]);
    const payload = {
      ...form,
      species: form.species || "不明",
      race: form.species || "不明",
      attribute: selectedAttributes[0] ?? "",
      attributes: selectedAttributes,
      letters: selectedLetters,
      letterAttributes,
      gimmicks: normalizeGimmickList(form.gimmicks ?? []),
      superGimmicks: normalizeSuperGimmickList(form.superGimmicks ?? []),
      groups: normalizedGroups,
      collabGroups: normalizedCollabGroups,
      review: form.review?.trim() || undefined,
      recommendedQuests: unique(form.recommendedQuests ?? []),
      adminMemo: form.adminMemo?.trim() || undefined,
      leaderTraitText: form.leaderTraitText?.trim() || undefined,
      normalMove: form.normalMove,
      superMove: form.superMove,
      exSkill: form.exSkill,
      chargeSkill: form.chargeSkill,
      kotowaza: form.kotowaza ?? [],
      traits: normalizeTraitEntries(form.traits),
      rarityType: form.rarityType ?? "",
      relatedCharacters: normalizeRelatedCharacters(form.relatedCharacters),
      relatedCharacterIds: unique(form.relatedCharacterIds ?? []),
      obtainedQuestIds: unique(form.obtainedQuestIds ?? []),
      recommendedQuestIds: unique(form.recommendedQuestIds ?? []),
    };
    const response = await adminFetch("/api/admin/characters", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    const data = await response.json();
    setForm(asForm(data.character, collabGroupOptions));
    setManualCount(data.total ?? manualCount);
    setStatus("保存しました。キャラ検索APIのキャッシュも更新済みです。");
  }

  async function uploadImage() {
    if (!selectedImageFile) {
      setError("画像ファイルを選択してください。");
      return;
    }
    setIsUploadingImage(true);
    setError("");
    setStatus("");
    try {
      const formData = new FormData();
      formData.append("file", selectedImageFile);
      formData.append("characterId", form.id || form.name || "manual-character");
      const response = await fetch("/api/admin/character-image", {
        method: "POST",
        headers: {
          "x-admin-password": adminPassword,
        },
        body: formData,
      });
      if (!response.ok) {
        setError(await response.text());
        return;
      }
      const data = (await response.json()) as { imageUrl: string; path: string };
      setUploadedImageUrl(data.imageUrl);
      setImageUrlInput(data.imageUrl);
      setImageFailed(false);
      update({ imageUrl: data.imageUrl, imageSourceUrl: data.path });
      setStatus(`画像をアップロードしました: ${data.path}`);
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function removeManual() {
    if (!form.id || !window.confirm("manual 側のこのキャラ情報を削除します。自動取得データは削除しません。")) {
      return;
    }
    const response = await adminFetch(`/api/admin/characters?id=${encodeURIComponent(form.id)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    const data = await response.json();
    setManualCount(data.total ?? 0);
    setForm(emptyCharacter());
    setStatus("manual 側のデータを削除しました。");
  }

  return (
    <>
      <header className="admin-hero">
        <div>
          <p className="eyebrow">ローカル管理</p>
          <h1>キャラクター編集</h1>
          <p>自動取得データは直接編集せず、`characters.manual.json` に手動追加・補正を保存します。</p>
        </div>
        <div className="admin-hero-meta">
          <span>manual: {manualCount.toLocaleString()}件</span>
          <button
            onClick={() => {
              setForm(emptyCharacter());
              setImageUrlInput("");
              setUploadedImageUrl("");
              setSelectedImageFile(null);
              setImageFailed(false);
            }}
            type="button"
          >
            <Plus size={16} aria-hidden />
            新規追加
          </button>
        </div>
      </header>

      <div className="admin-character-layout">
        <aside className="admin-panel admin-search-panel">
          <h2>既存キャラ検索</h2>
          <label className="character-search">
            <Search size={17} aria-hidden />
            <input
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void runSearch();
              }}
              placeholder="キャラ名・持ち文字・ギミックで検索"
              value={query}
            />
          </label>
          <div className="actions">
            <button className="primary" disabled={isSearching} onClick={() => void runSearch()} type="button">
              <Search size={16} aria-hidden />
              検索
            </button>
            <button onClick={() => setResults([])} type="button">
              <RotateCcw size={16} aria-hidden />
              クリア
            </button>
          </div>
          {status ? <p className="status">{status}</p> : null}
          <div className="admin-search-results">
            {results.map((character) => (
              <button
                className="admin-result-card"
                key={character.id}
                onClick={() => {
                  editCharacter(character);
                }}
                type="button"
              >
                {character.imageUrl ? <img alt="" src={character.imageUrl} /> : <span>{character.name.slice(0, 1)}</span>}
                <strong>{character.name}</strong>
                <small>{(character.attributes ?? [character.attribute]).filter(Boolean).join("/") || "属性なし"}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="admin-panel admin-editor-panel">
          <div className="section-heading">
            <h2>{form.id ? "キャラ情報編集" : "新規キャラ追加"}</h2>
            <span className="muted">{form.id || "保存時にmanual IDを発行"}</span>
          </div>

          {error ? <p className="status error">{error}</p> : null}
          <div className="admin-editor-grid">
            <label>
              キャラ名
              <input value={form.name} onChange={(event) => update({ name: event.target.value })} />
            </label>
            <label>
              種族
              <select value={form.species} onChange={(event) => update({ species: event.target.value, race: event.target.value })}>
                {SPECIES.map((species) => (
                  <option key={species} value={species}>{species}</option>
                ))}
              </select>
            </label>
            <label>
              特殊レアリティ
              <select value={form.rarityType ?? ""} onChange={(event) => update({ rarityType: event.target.value as CharacterRarityType })}>
                {RARITY_TYPES.map((rarity) => (
                  <option key={rarity || "none"} value={rarity}>{rarity || "なし"}</option>
                ))}
              </select>
              <span className="admin-rarity-preview">
                <SpecialRarityBadge compact rarity={form.rarityType} />
              </span>
            </label>
            <label className="wide">
              画像URL
              <input
                value={imageUrlInput}
                onChange={(event) => setImageUrlInput(event.target.value)}
              />
            </label>
            <label className="wide">
              参照元URL
              <input value={form.sourceUrl ?? ""} onChange={(event) => update({ sourceUrl: event.target.value })} />
            </label>
            <label className="wide">
              メモ
              <textarea value={form.memo ?? ""} onChange={(event) => update({ memo: event.target.value })} />
            </label>
          </div>

          <div className="admin-edit-section">
            <h3>攻略情報</h3>
            <div className="admin-editor-grid">
              <label className="wide">
                評価
                <textarea
                  value={form.review ?? ""}
                  onChange={(event) => update({ review: event.target.value })}
                  placeholder={"Sランク相当。\n汎用性が高く初心者にもおすすめ。\n冥属性デッキの主力。"}
                />
              </label>
              <label className="wide">
                適正降臨クエスト
                <textarea
                  value={(form.recommendedQuests ?? []).join("\n")}
                  onChange={(event) =>
                    update({
                      recommendedQuests: unique(event.target.value.split(/\r?\n/u)),
                    })
                  }
                  placeholder={"〇〇降臨\n△△降臨\n□□降臨"}
                />
              </label>
              <label className="wide">
                管理者メモ
                <textarea
                  value={form.adminMemo ?? ""}
                  onChange={(event) => update({ adminMemo: event.target.value })}
                  placeholder="攻略メモや更新メモ"
                />
              </label>
            </div>
          </div>

          <div className="admin-image-preview">
            {form.imageUrl && !imageFailed ? (
              <img alt={form.name || "キャラ画像"} onError={() => setImageFailed(true)} src={form.imageUrl} />
            ) : (
              <span><ImageOff size={28} aria-hidden />画像プレビュー</span>
            )}
          </div>

          <div className="admin-image-tools">
            <label className="admin-file-picker">
              <Upload size={16} aria-hidden />
              <span>{selectedImageFile ? selectedImageFile.name : "画像ファイルを選択"}</span>
              <input
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => setSelectedImageFile(event.target.files?.[0] ?? null)}
                type="file"
              />
            </label>
            <div className="actions">
              <button disabled={!selectedImageFile || isUploadingImage} onClick={() => void uploadImage()} type="button">
                <Upload size={16} aria-hidden />
                {isUploadingImage ? "アップロード中..." : "アップロード画像を使う"}
              </button>
              <button
                disabled={!imageUrlInput.trim()}
                onClick={() => {
                  setImageFailed(false);
                  setUploadedImageUrl("");
                  update({ imageUrl: imageUrlInput.trim(), imageSourceUrl: form.sourceUrl || imageUrlInput.trim() });
                }}
                type="button"
              >
                URL画像を使う
              </button>
              <button
                onClick={() => {
                  setImageFailed(false);
                  setImageUrlInput("");
                  setUploadedImageUrl("");
                  setSelectedImageFile(null);
                  update({ imageUrl: "", imageSourceUrl: "" });
                }}
                type="button"
              >
                画像をクリア
              </button>
            </div>
            {uploadedImageUrl ? <p className="muted">アップロード済み: {uploadedImageUrl}</p> : null}
          </div>

          <div className="admin-edit-section">
            <h3>属性</h3>
            <OptionButtons options={ATTRIBUTES} selected={selectedAttributes} onToggle={toggleAttribute} className={attrClass} />
          </div>

          <div className="admin-edit-section">
            <h3>持ち文字</h3>
            <KanaGrid rows={KANA_ROWS} selected={selectedLetters} onToggle={toggleLetter} />
            <h4>小文字</h4>
            <KanaGrid rows={SMALL_KANA_ROWS} selected={selectedLetters} onToggle={toggleLetter} />
          </div>

          {letterAttributes.length ? (
            <div className="admin-edit-section">
              <h3>文字ごとの属性</h3>
              <div className="letter-attribute-editor">
                {letterAttributes.map((item) => (
                  <div className="letter-attribute-row" key={item.letter}>
                    <strong>{item.letter}</strong>
                    <OptionButtons
                      options={ATTRIBUTES}
                      selected={item.attributes}
                      onToggle={(attribute) => toggleLetterAttribute(item.letter, attribute)}
                      className={attrClass}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="admin-edit-section">
            <h3>リーダー特性</h3>
            <OptionButtons
              options={LEADER_TRAITS}
              selected={form.leaderTraits ?? []}
              onToggle={(value) => update({ leaderTraits: toggle(form.leaderTraits ?? [], value) })}
            />
            <label className="wide admin-stacked-field">
              リーダー特性全文
              <textarea
                value={form.leaderTraitText ?? ""}
                onChange={(event) => update({ leaderTraitText: event.target.value })}
                placeholder="リーダーとくせいの効果全文"
              />
            </label>
          </div>

          <div className="admin-edit-section">
            <h3>ギミック耐性</h3>
            <OptionButtons
              options={COMBINED_GIMMICK_OPTIONS}
              selected={[
                ...(form.gimmicks ?? []),
                ...(form.superGimmicks ?? []).map(superGimmickDisplayName),
              ]}
              onToggle={toggleCombinedGimmick}
            />
          </div>

          <div className="admin-edit-section">
            <h3>わざ / すごわざ / ことわざ</h3>
            <div className="admin-editor-grid">
              <div className="admin-stacked-field">
                <span className="filter-label">わざ条件（選択式）</span>
                <MoveConditionEditor
                  conditions={form.normalMove?.conditions ?? []}
                  onChange={(conditions) => updateMove("normalMove", { conditions })}
                />
              </div>
              <label>
                わざ効果
                <textarea
                  value={form.normalMove?.effect ?? ""}
                  onChange={(event) => updateMove("normalMove", { effect: event.target.value })}
                />
              </label>
              <div className="admin-stacked-field">
                <span className="filter-label">すごわざ条件（選択式）</span>
                <MoveConditionEditor
                  conditions={form.superMove?.conditions ?? []}
                  onChange={(conditions) => updateMove("superMove", { conditions })}
                />
              </div>
              <label>
                すごわざ効果
                <textarea
                  value={form.superMove?.effect ?? ""}
                  onChange={(event) => updateMove("superMove", { effect: event.target.value })}
                />
              </label>
            </div>
            <div className="admin-kotowaza-editor">
              {KOTOWAZA_LEVELS.map((level) => {
                const item = kotowazaItem(level);
                return (
                  <div className="admin-kotowaza-row" key={level}>
                    <strong>{level === 0 ? "無凸" : `${level}凸`}</strong>
                    <div className="admin-stacked-field">
                      <span className="filter-label">条件（選択式）</span>
                      <MoveConditionEditor
                        conditions={item.conditions ?? []}
                        onChange={(conditions) => updateKotowaza(level, { conditions })}
                      />
                    </div>
                    <label>
                      効果
                      <textarea
                        value={item.effect ?? ""}
                        onChange={(event) => updateKotowaza(level, { effect: event.target.value })}
                        placeholder="効果"
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="admin-edit-section">
            <h3>EXスキル / チャージスキル</h3>
            <div className="admin-editor-grid">
              <label>
                EXスキル名
                <input
                  value={form.exSkill?.name ?? ""}
                  onChange={(event) => updateSkill("exSkill", { name: event.target.value })}
                  placeholder="EXスキル名"
                />
              </label>
              <label>
                EXスキル概要
                <input
                  value={form.exSkill?.summary ?? ""}
                  onChange={(event) => updateSkill("exSkill", { summary: event.target.value })}
                  placeholder="検索カード向けの短い説明"
                />
              </label>
              <label className="wide">
                EXスキル効果全文
                <textarea
                  value={form.exSkill?.effect ?? ""}
                  onChange={(event) => updateSkill("exSkill", { effect: event.target.value })}
                />
              </label>
              <label>
                チャージスキル名
                <input
                  value={form.chargeSkill?.name ?? ""}
                  onChange={(event) => updateSkill("chargeSkill", { name: event.target.value })}
                  placeholder="チャージスキル名"
                />
              </label>
              <label>
                チャージスキル概要
                <input
                  value={form.chargeSkill?.summary ?? ""}
                  onChange={(event) => updateSkill("chargeSkill", { summary: event.target.value })}
                  placeholder="検索カード向けの短い説明"
                />
              </label>
              <label className="wide">
                チャージスキル効果全文
                <textarea
                  value={form.chargeSkill?.effect ?? ""}
                  onChange={(event) => updateSkill("chargeSkill", { effect: event.target.value })}
                />
              </label>
            </div>
          </div>

          <div className="admin-edit-section">
            <h3>関連コトダマン</h3>
            <p className="muted">上部のキャラ検索結果から、技などで関連するコトダマンを追加できます。</p>
            {normalizeRelatedCharacters(form.relatedCharacters).length ? (
              <div className="admin-related-list">
                {normalizeRelatedCharacters(form.relatedCharacters).map((item) => {
                  const related = results.find((result) => result.id === item.characterId);
                  return (
                    <div className="admin-related-row" key={item.characterId}>
                      <strong>{related?.name ?? item.characterId}</strong>
                      <input
                        value={item.memo ?? ""}
                        onChange={(event) => updateRelatedCharacter(item.characterId, { memo: event.target.value })}
                        placeholder="メモ"
                      />
                      <button onClick={() => removeRelatedCharacter(item.characterId)} type="button">
                        削除
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="muted">関連コトダマン未登録</p>
            )}
            {results.length ? (
              <div className="admin-related-candidates">
                {results
                  .filter((result) => result.id !== form.id)
                  .slice(0, 24)
                  .map((result) => (
                    <button
                      disabled={normalizeRelatedCharacters(form.relatedCharacters).some((item) => item.characterId === result.id)}
                      key={result.id}
                      onClick={() => addRelatedCharacter(result.id)}
                      type="button"
                    >
                      {result.name}
                    </button>
                  ))}
              </div>
            ) : null}
          </div>

          <div className="admin-edit-section">
            <h3>クエスト連携</h3>
            <p className="muted">クエスト管理タブに登録したクエストを、入手方法・適正クエストとして紐付けます。</p>
            {questOptions.length ? (
              <div className="quest-picker-grid">
                <div>
                  <h4>入手方法クエスト</h4>
                  <OptionButtons
                    options={questOptions.map((quest) => quest.questId)}
                    selected={form.obtainedQuestIds ?? []}
                    onToggle={(questId) => toggleQuestId("obtainedQuestIds", questId)}
                    getOptionLabel={(questId) => questOptions.find((quest) => quest.questId === questId)?.questName ?? questId}
                  />
                </div>
                <div>
                  <h4>適正クエスト</h4>
                  <OptionButtons
                    options={questOptions.map((quest) => quest.questId)}
                    selected={form.recommendedQuestIds ?? []}
                    onToggle={(questId) => toggleQuestId("recommendedQuestIds", questId)}
                    getOptionLabel={(questId) => questOptions.find((quest) => quest.questId === questId)?.questName ?? questId}
                  />
                </div>
              </div>
            ) : (
              <p className="muted">クエストマスターが未登録です。先に「クエスト管理」タブで追加してください。</p>
            )}
          </div>

          <div className="admin-edit-section">
            <h3>とくせい</h3>
            <TraitInstanceEditor
              templates={traitTemplates}
              traits={form.traits ?? []}
              onChange={(traits) => update({ traits })}
            />
          </div>

          <div className="admin-edit-section">
            <h3>グループ</h3>
            <h4>オリジナルグループ</h4>
            {groupOptions.length ? (
              <OptionButtons
                options={groupOptions}
                selected={form.groups ?? []}
                onToggle={(value) => update({ groups: toggle(form.groups ?? [], value) })}
                getOptionLabel={(value) => groupDisplayNames[value] ?? value}
              />
            ) : (
              <p className="muted">取得済みオリジナルグループ候補はまだありません。</p>
            )}
            <div className="admin-inline-input">
              <input
                onChange={(event) => setGroupInput(event.target.value)}
                placeholder="オリジナルグループ名を手入力"
                value={groupInput}
              />
              <button
                disabled={!groupInput.trim()}
                onClick={() => {
                  const group = groupInput.trim();
                  update({ groups: unique([...(form.groups ?? []), group]) });
                  setGroupOptions((current) => unique([...current, group]).sort((a, b) => a.localeCompare(b, "ja")));
                  setGroupInput("");
                }}
                type="button"
              >
                追加
              </button>
            </div>
            <h4>コラボグループ</h4>
            {collabGroupOptions.length ? (
              <OptionButtons
                options={collabGroupOptions}
                selected={form.collabGroups ?? []}
                onToggle={(value) => update({ collabGroups: toggle(form.collabGroups ?? [], value) })}
                getOptionLabel={(value) => collabGroupDisplayNames[value] ?? value}
              />
            ) : (
              <p className="muted">取得済みコラボグループ候補はまだありません。</p>
            )}
            <div className="admin-inline-input">
              <input
                onChange={(event) => setCollabGroupInput(event.target.value)}
                placeholder="コラボグループ名を手入力"
                value={collabGroupInput}
              />
              <button
                disabled={!collabGroupInput.trim()}
                onClick={() => {
                  const group = collabGroupInput.trim();
                  update({ collabGroups: unique([...(form.collabGroups ?? []), group]) });
                  setCollabGroupOptions((current) => unique([...current, group]).sort((a, b) => a.localeCompare(b, "ja")));
                  setCollabGroupInput("");
                }}
                type="button"
              >
                追加
              </button>
            </div>
          </div>

          <div className="actions admin-save-actions">
            <button className="primary" disabled={!canSave} onClick={() => void save()} type="button">
              <Save size={16} aria-hidden />
              保存
            </button>
            <button className="danger" disabled={!form.id} onClick={() => void removeManual()} type="button">
              <Trash2 size={16} aria-hidden />
              manual削除
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
