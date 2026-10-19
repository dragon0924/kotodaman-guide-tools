"use client";

import { leaderInformationState } from "@/lib/characterDetailDisplay";
import { Plus, RotateCcw, Search } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { searchCharacters } from "@/lib/characters";
import { createCharacterSearchRequests, hasRestorableCharacterSearchResults } from "@/lib/characterSearchRequests";
import { SpecialRarityBadge } from "@/components/SpecialRarityBadge";
import { TraitSearchFilters } from "@/components/TraitSearchFilters";
import {
  COMBINED_GIMMICK_OPTIONS,
  combinedGimmickDisplayList,
  isSuperGimmickDisplayName,
  superGimmickDisplayName,
  superGimmickValueFromDisplay,
} from "@/lib/gimmicks";
import { SPECIAL_RARITY_TYPES, rarityClass } from "@/lib/rarity";
import type {
  CharacterDataMeta,
  CharacterLetter,
  CharacterSearchFilters,
  CharacterSearchMatchMode,
  CharacterSearchResult,
  DeckCharacter,
} from "@/lib/types";

type CharacterSearchPanelProps = {
  mode?: "browse" | "selectForTeam";
  deck?: DeckCharacter[];
  meta: CharacterDataMeta | null;
  isLoading: boolean;
  error: string | null;
  onAddToDeckSlot?: (character: CharacterSearchResult, slotId: number) => void;
  onAddToNextEmpty?: (character: CharacterSearchResult) => void;
};

const CHARACTER_SEARCH_PAGE_SIZE = 100;
const CHARACTER_SEARCH_STATE_KEY = "kotodaman-character-search-state:v2";

function searchRequestStamp(query: string, filters: CharacterSearchFilters = {}, matchMode = "or", letterMode = "or", traitMode = "and") {
  const keys = ["attributes", "species", "leaderTraits", "gimmicks", "superGimmicks", "groups", "letters", "traits", "rarityTypes", "traitNames", "traitCategories"] as const;
  return JSON.stringify([query.trim(), ...keys.map(key => filters[key] ?? []), matchMode, letterMode, traitMode]);
}

function hasSavedSearchResults() {
  try {
    const raw = window.sessionStorage.getItem(CHARACTER_SEARCH_STATE_KEY);
    if (!raw) {
      return false;
    }
    return hasRestorableCharacterSearchResults(JSON.parse(raw));
  } catch {
    window.sessionStorage.removeItem(CHARACTER_SEARCH_STATE_KEY);
    return false;
  }
}

const ATTRIBUTE_OPTIONS = ["火", "水", "木", "光", "闇", "冥", "天", "虹"];
const SPECIES_OPTIONS = ["神", "英", "龍", "物", "獣", "霊", "魔", "妖"];
const LEADER_TRAIT_OPTIONS = [
  "毒",
  "混乱",
  "睡眠",
  "呪い",
  "汚染",
  "炎上",
  "改造",
  "衰弱",
  "変異",
  "消去",
];
const NORMAL_LETTER_OPTIONS = [
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
].flat();
const SMALL_LETTER_OPTIONS = [
  ["ぁ", "ぃ", "ぅ", "ぇ", "ぉ"],
  ["ゃ", null, "ゅ", null, "ょ"],
  ["っ", null, null, null, null],
].flat();

function attributeClass(attribute?: string) {
  if (!attribute) return "attr-unknown";
  if (attribute.includes("火")) return "attr-fire";
  if (attribute.includes("水")) return "attr-water";
  if (attribute.includes("木")) return "attr-wood";
  if (attribute.includes("光")) return "attr-light";
  if (attribute.includes("闇")) return "attr-dark";
  if (attribute.includes("天")) return "attr-sky";
  if (attribute.includes("冥")) return "attr-nether";
  if (attribute.includes("虹")) return "attr-rainbow";
  return "attr-unknown";
}

function attributeColor(attribute?: string) {
  if (!attribute) return "#8b949e";
  if (attribute.includes("火")) return "#e74c3c";
  if (attribute.includes("水")) return "#3498db";
  if (attribute.includes("木")) return "#27ae60";
  if (attribute.includes("光")) return "#f1c40f";
  if (attribute.includes("闇")) return "#8e44ad";
  if (attribute.includes("天")) return "#bff7ff";
  if (attribute.includes("冥")) return "#2c3e50";
  if (attribute.includes("虹")) return "#7c3aed";
  return "#8b949e";
}

function letterAttributeStyle(attributes: string[] = []): CSSProperties {
  const uniqueAttributes = Array.from(new Set(attributes.filter(Boolean)));
  if (uniqueAttributes.some((attribute) => attribute.includes("虹"))) {
    return {
      "--letter-attr-bg": "conic-gradient(#e74c3c, #f1c40f, #27ae60, #3498db, #8e44ad, #e74c3c)",
      "--letter-attr-border": "#7c3aed",
    } as CSSProperties;
  }
  if (uniqueAttributes.length <= 1) {
    const color = attributeColor(uniqueAttributes[0]);
    return {
      "--letter-attr-bg": color,
      "--letter-attr-border": color,
    } as CSSProperties;
  }
  const step = 100 / uniqueAttributes.length;
  const stops = uniqueAttributes.flatMap((attribute, index) => {
    const color = attributeColor(attribute);
    return [`${color} ${index * step}%`, `${color} ${(index + 1) * step}%`];
  });
  return {
    "--letter-attr-bg": `conic-gradient(${stops.join(", ")})`,
    "--letter-attr-border": attributeColor(uniqueAttributes[0]),
  } as CSSProperties;
}

function multiAttributeStyle(attributes: string[]): CSSProperties | undefined {
  if (attributes.length <= 1 || attributes.some((attribute) => attribute.includes("虹"))) {
    return undefined;
  }
  return {
    "--attr-gradient": `linear-gradient(180deg, ${attributes.map(attributeColor).join(", ")})`,
  } as CSSProperties;
}

function speciesShortName(value?: string) {
  const text = String(value ?? "").trim();
  if (!text || text.includes("不明")) return "?";
  if (text.includes("英雄") || text === "英" || text.includes("英種族")) return "英";
  if (text.includes("龍") || text.includes("竜")) return "龍";
  if (text.includes("神")) return "神";
  if (text.includes("物")) return "物";
  if (text.includes("獣")) return "獣";
  if (text.includes("霊")) return "霊";
  if (text.includes("魔")) return "魔";
  if (text.includes("妖")) return "妖";
  return text.slice(0, 1);
}

function truncateName(name?: string) {
  if (!name) return "";
  return name.length > 4 ? `${name.slice(0, 4)}...` : name;
}

function toggle(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function FilterButtonGrid({
  label,
  options,
  selected,
  onToggle,
  compact = false,
  optionClassName,
  getOptionLabel,
}: {
  label: string;
  options: Array<string | null>;
  selected: string[];
  onToggle: (value: string) => void;
  compact?: boolean;
  optionClassName?: (value: string) => string;
  getOptionLabel?: (value: string) => string;
}) {
  return (
    <div className={`filter-buttons ${compact ? "compact kana-grid" : ""}`}>
      {options.map((option, index) =>
        option ? (
          <button
            aria-pressed={selected.includes(option)}
            className={`${selected.includes(option) ? "selected" : ""} ${
              optionClassName?.(option) ?? ""
            }`}
            key={option}
            onClick={() => onToggle(option)}
            type="button"
        >
          {getOptionLabel?.(option) ?? option}
        </button>
        ) : (
          <span className="kana-grid-empty" key={`empty-${label}-${index}`} aria-hidden />
        ),
      )}
    </div>
  );
}

function FilterCategory({
  label,
  selectedCount,
  defaultOpen = false,
  children,
}: {
  label: string;
  selectedCount: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const storageKey = `kotodaman-character-filter-category-open:${label}`;
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const details = detailsRef.current;
    const saved = window.localStorage.getItem(storageKey);
    if (details) {
      details.open = saved === null ? defaultOpen : saved === "1";
    }
  }, [defaultOpen, storageKey]);

  return (
    <details
      ref={detailsRef}
      className="filter-group game-filter-group filter-category"
      data-filter-category={label}
      onToggle={(event) => {
        window.localStorage.setItem(storageKey, event.currentTarget.open ? "1" : "0");
      }}
    >
      <summary className="filter-label">
        <span>{label}</span>
        {selectedCount ? <small className="filter-category-count">{selectedCount}件選択</small> : null}
      </summary>
      <div className="filter-category-content">{children}</div>
    </details>
  );
}

function FilterField({
  label,
  options,
  selected,
  onToggle,
  compact = false,
  optionClassName,
}: {
  label: string;
  options: Array<string | null>;
  selected: string[];
  onToggle: (value: string) => void;
  compact?: boolean;
  optionClassName?: (value: string) => string;
}) {
  return (
    <div className="filter-subsection">
      <div className="filter-subsection-heading">
        <span>{label}</span>
        {selected.length ? <small>{selected.length}件選択</small> : null}
      </div>
      <FilterButtonGrid
        compact={compact}
        label={label}
        options={options}
        selected={selected}
        onToggle={onToggle}
        optionClassName={optionClassName}
      />
    </div>
  );
}

// Kept temporarily as a fallback while the modal picker is stabilized.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LetterFilterGroup({
  letterMatchMode,
  onLetterMatchModeChange,
  selected,
  onToggle,
}: {
  letterMatchMode: CharacterSearchMatchMode;
  onLetterMatchModeChange: (mode: CharacterSearchMatchMode) => void;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const storageKey = "kotodaman-character-filter-open:持ち文字";
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const details = detailsRef.current;
    if (details) {
      details.open = window.localStorage.getItem(storageKey) === "1";
    }
  }, []);

  return (
    <details
      ref={detailsRef}
      className="filter-group game-filter-group combined-letter-filter"
      onToggle={(event) => {
        const nextOpen = event.currentTarget.open;
        window.localStorage.setItem(storageKey, nextOpen ? "1" : "0");
      }}
    >
      <summary className="filter-label">持ち文字</summary>
      <div className="letter-filter-content">
        <div className="letter-match-mode inline">
          <span className="filter-label">持ち文字検索モード</span>
          <div className="segmented-control" role="group" aria-label="持ち文字検索モード">
            <button
              className={letterMatchMode === "or" ? "selected" : ""}
              onClick={() => onLetterMatchModeChange("or")}
              type="button"
            >
              いずれか一致
            </button>
            <button
              className={letterMatchMode === "and" ? "selected" : ""}
              onClick={() => onLetterMatchModeChange("and")}
              type="button"
            >
              すべて一致
            </button>
          </div>
        </div>
        <div className="letter-filter-block">
          <span className="letter-filter-heading">通常文字</span>
          <FilterButtonGrid
            compact
            label="通常文字"
            options={NORMAL_LETTER_OPTIONS}
            selected={selected}
            onToggle={onToggle}
          />
        </div>
        <div className="letter-filter-block">
          <span className="letter-filter-heading">小文字</span>
          <FilterButtonGrid
            compact
            label="小文字"
            options={SMALL_LETTER_OPTIONS}
            selected={selected}
            onToggle={onToggle}
          />
        </div>
      </div>
    </details>
  );
}

function LetterFilterModalGroup({
  letterMatchMode,
  onLetterMatchModeChange,
  selected,
  onToggle,
}: {
  letterMatchMode: CharacterSearchMatchMode;
  onLetterMatchModeChange: (mode: CharacterSearchMatchMode) => void;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftSelected, setDraftSelected] = useState<string[]>(selected);
  const [draftMatchMode, setDraftMatchMode] = useState<CharacterSearchMatchMode>(letterMatchMode);

  function openModal() {
    setDraftSelected(selected);
    setDraftMatchMode(letterMatchMode);
    setIsOpen(true);
  }

  function applyModal() {
    const selectedSet = new Set(selected);
    const draftSet = new Set(draftSelected);
    selected.filter((value) => !draftSet.has(value)).forEach(onToggle);
    draftSelected.filter((value) => !selectedSet.has(value)).forEach(onToggle);
    onLetterMatchModeChange(draftMatchMode);
    setIsOpen(false);
  }

  return (
    <div className="filter-subsection letter-picker-filter">
      <div className="filter-subsection-heading">
        <span>文字</span>
        {selected.length ? <small>{selected.length}文字選択</small> : null}
      </div>
      <div className="letter-picker-summary">
        <button className="secondary" onClick={openModal} type="button">
          持ち文字を選択
        </button>
        <span className="muted">
          {selected.length ? `${selected.length}文字 / ${letterMatchMode === "and" ? "すべて一致" : "いずれか一致"}` : "未選択"}
        </span>
      </div>
      {selected.length ? (
        <div className="selected-letter-chips">
          {selected.map((letter) => (
            <span className="tag muted-tag" key={letter}>{letter}</span>
          ))}
        </div>
      ) : null}

      {isOpen ? (
        <div className="letter-picker-backdrop" role="presentation" onClick={() => setIsOpen(false)}>
          <div
            aria-modal="true"
            className="letter-picker-modal"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-heading compact-heading">
              <h3>持ち文字を選択</h3>
              <button className="ghost" onClick={() => setIsOpen(false)} type="button">閉じる</button>
            </div>
            <div className="letter-match-mode inline">
              <span className="filter-label">持ち文字検索モード</span>
              <div className="segmented-control" role="group" aria-label="持ち文字検索モード">
                <button
                  className={draftMatchMode === "or" ? "selected" : ""}
                  onClick={() => setDraftMatchMode("or")}
                  type="button"
                >
                  いずれか一致
                </button>
                <button
                  className={draftMatchMode === "and" ? "selected" : ""}
                  onClick={() => setDraftMatchMode("and")}
                  type="button"
                >
                  すべて一致
                </button>
              </div>
            </div>
            <div className="letter-filter-block">
              <span className="letter-filter-heading">通常文字</span>
              <FilterButtonGrid
                compact
                label="通常文字"
                options={NORMAL_LETTER_OPTIONS}
                selected={draftSelected}
                onToggle={(value) => setDraftSelected((current) => toggle(current, value))}
              />
            </div>
            <div className="letter-filter-block">
              <span className="letter-filter-heading">小文字</span>
              <FilterButtonGrid
                compact
                label="小文字"
                options={SMALL_LETTER_OPTIONS}
                selected={draftSelected}
                onToggle={(value) => setDraftSelected((current) => toggle(current, value))}
              />
            </div>
            <div className="actions">
              <button className="primary" onClick={applyModal} type="button">適用</button>
              <button
                onClick={() => {
                  setDraftSelected([]);
                  setDraftMatchMode("or");
                }}
                type="button"
              >
                クリア
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GroupFilterGroup({
  originalGroups,
  collabGroups,
  groupDisplayNames,
  collabGroupDisplayNames,
  selected,
  onToggle,
}: {
  originalGroups: string[];
  collabGroups: string[];
  groupDisplayNames: Record<string, string>;
  collabGroupDisplayNames: Record<string, string>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [activeGroupTab, setActiveGroupTab] = useState<"original" | "collab">("original");

  if (!originalGroups.length && !collabGroups.length) {
    return null;
  }

  const currentOptions = activeGroupTab === "original" ? originalGroups : collabGroups;
  const currentDisplayNames = activeGroupTab === "original" ? groupDisplayNames : collabGroupDisplayNames;

  return (
    <div className="filter-subsection group-filter-group filter-subsection-wide">
      <div className="filter-subsection-heading">
        <span>グループ</span>
        {selected.length ? <small>{selected.length}件選択</small> : null}
      </div>
      <div className="group-filter-tabs">
        <div className="segmented-control group-filter-tab-list" role="tablist" aria-label="グループ種別">
          <button
            aria-selected={activeGroupTab === "original"}
            className={activeGroupTab === "original" ? "selected" : ""}
            onClick={() => setActiveGroupTab("original")}
            role="tab"
            type="button"
          >
            <span className="group-tab-label">オリジナル</span>
            <small className="group-count-badge">{originalGroups.length}</small>
          </button>
          <button
            aria-selected={activeGroupTab === "collab"}
            className={activeGroupTab === "collab" ? "selected" : ""}
            onClick={() => setActiveGroupTab("collab")}
            role="tab"
            type="button"
          >
            <span className="group-tab-label">コラボ</span>
            <small className="group-count-badge">{collabGroups.length}</small>
          </button>
        </div>
        {currentOptions.length ? (
          <FilterButtonGrid
            label={activeGroupTab === "original" ? "オリジナルグループ" : "コラボグループ"}
            options={currentOptions}
            selected={selected}
            onToggle={onToggle}
            getOptionLabel={(value) => currentDisplayNames[value] ?? value}
          />
        ) : (
          <p className="muted">このグループ種別の候補はまだありません。</p>
        )}
      </div>
    </div>
  );
}

function LetterAttributeTags({ letters }: { letters: CharacterLetter[] }) {
  if (!letters.length) {
    return <span className="muted">未取得</span>;
  }
  return (
    <>
      {letters.map((item) => (
        <span
          className={`tag letter-attribute-tag ${attributeClass(item.attributes[0])}`}
          key={`${item.letter}-${item.attributes.join("/")}`}
          style={letterAttributeStyle(item.attributes)}
          title={item.attributes.join("/")}
        >
          <strong>{item.letter}</strong>
        </span>
      ))}
    </>
  );
}

function CharacterThumb({
  className,
  imageUrl,
  name,
  placeholderClassName,
}: {
  className: string;
  imageUrl?: string;
  name: string;
  placeholderClassName: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (imageUrl && !hasError) {
    return (
      <img
        className={className}
        src={imageUrl}
        alt={name}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
      />
    );
  }

  return <span className={`${className} ${placeholderClassName}`}>{name.slice(0, 1)}</span>;
}

export function CharacterSearchPanel({
  mode = "browse",
  deck = [],
  meta,
  isLoading,
  error,
  onAddToDeckSlot,
  onAddToNextEmpty,
}: CharacterSearchPanelProps) {
  const isTeamSelectMode = mode === "selectForTeam";
  const [hasRestoredSearch, setHasRestoredSearch] = useState(isTeamSelectMode);
  const [query, setQuery] = useState("");
  const [matchMode, setMatchMode] = useState<CharacterSearchMatchMode>("or");
  const [letterMatchMode, setLetterMatchMode] = useState<CharacterSearchMatchMode>("or");
  const [traitMatchMode, setTraitMatchMode] = useState<CharacterSearchMatchMode>("and");
  const [traitReset, setTraitReset] = useState(0);
  const [filters, setFilters] = useState<Required<Omit<CharacterSearchFilters, "matchMode" | "letterMatchMode" | "traitMatchMode" | "traitSource">>>({
    attributes: [],
    species: [],
    leaderTraits: [],
    gimmicks: [],
    superGimmicks: [],
    groups: [],
    letters: [],
    traits: [],
    traitNames: [],
    traitCategories: [],
    rarityTypes: [],
  });
  const [results, setResults] = useState<CharacterSearchResult[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [appliedSearchStamp, setAppliedSearchStamp] = useState<string | null>(null);
  const [resultLimit, setResultLimit] = useState(CHARACTER_SEARCH_PAGE_SIZE);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [gimmickView, setGimmickView] = useState<"normal" | "super">("normal");
  const [isCharactersPath, setIsCharactersPath] = useState(false);
  const searchRequests = useRef(createCharacterSearchRequests());
  const [completedSearchRequest, setCompletedSearchRequest] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [actionsVisible, setActionsVisible] = useState(false);

  const totalCharacters = meta?.totalCharacters ?? 0;
  const hasNoImportedData = !isLoading && !error && totalCharacters === 0;
  const collabGroupOptions = useMemo(() => meta?.collabGroupOptions ?? [], [meta]);
  const groupDisplayNames = useMemo(() => meta?.groupDisplayNames ?? {}, [meta]);
  const collabGroupDisplayNames = useMemo(() => meta?.collabGroupDisplayNames ?? {}, [meta]);
  const originalGroupOptions = useMemo(() => {
    const collabSet = new Set(collabGroupOptions);
    return (meta?.groupOptions ?? []).filter((group) => !collabSet.has(group));
  }, [collabGroupOptions, meta]);
  const hasActiveFilters = useMemo(
    () => Object.values(filters).some((values) => values.length > 0),
    [filters],
  );
  const basicFilterCount =
    filters.attributes.length +
    filters.species.length +
    filters.groups.length +
    filters.letters.length +
    filters.rarityTypes.length;
  const gimmickFilterCount = filters.gimmicks.length + filters.superGimmicks.length;
  const currentSearchStamp = searchRequestStamp(query, filters, matchMode, letterMatchMode, traitMatchMode);
  const resultIsStale = appliedSearchStamp !== currentSearchStamp;
  const normalGimmickOptions = COMBINED_GIMMICK_OPTIONS.filter((option) => !isSuperGimmickDisplayName(option));
  const superGimmickOptions = COMBINED_GIMMICK_OPTIONS.filter(isSuperGimmickDisplayName);
  const hasNoSearchMatches =
    !isLoading && !isSearching && !searchError && totalCharacters > 0 && results.length === 0;

  function requestFilters(): CharacterSearchFilters {
    return {
      ...filters,
      matchMode,
      letterMatchMode,
      traitMatchMode,
    };
  }

  async function runSearch(limit = resultLimit, kind: "submit" | "more" = "submit") {
    if (isLoading || error || hasNoImportedData) {
      return;
    }
    const request = searchRequests.current.begin(kind);
    setIsLoadingMore(kind === "more");
    setIsSearching(true);
    setSearchError(null);
    try {
      const response = await searchCharacters(query, limit, requestFilters());
      if (!searchRequests.current.isCurrent(request)) return;
      setResults(response.results);
      setTotalMatches(response.totalMatches);
      setAppliedSearchStamp(currentSearchStamp);
      setResultLimit(limit);
      setCompletedSearchRequest(request);
    } catch (caught) {
      if (!searchRequests.current.isCurrent(request)) return;
      searchRequests.current.cancelScroll();
      setResults([]);
      setTotalMatches(0);
      setSearchError(caught instanceof Error ? caught.message : "キャラクター検索に失敗しました。");
    } finally {
      if (searchRequests.current.isCurrent(request)) {
        setIsSearching(false);
        setIsLoadingMore(false);
      }
    }
  }

  useEffect(() => {
    if (isSearching || !completedSearchRequest) return;
    const frame = window.requestAnimationFrame(() => {
      if (!searchRequests.current.consumeScroll(completedSearchRequest) || resultIsStale) return;
      const target = resultsRef.current?.querySelector<HTMLElement>(".character-card, .character-no-results");
      // Both search panels remain mounted; never scroll a panel hidden by another tab.
      if (!target?.getClientRects().length) return;
      let offset = 12;
      document.querySelectorAll<HTMLElement>(".guide-header, .guide-primary-nav").forEach(header => {
        const position = window.getComputedStyle(header).position;
        const rect = header.getBoundingClientRect();
        if ((position === "fixed" || position === "sticky") && rect.top <= 0 && rect.bottom > 0) {
          offset = Math.max(offset, rect.bottom + 12);
        }
      });
      window.scrollTo({
        top: Math.max(0, window.scrollY + target.getBoundingClientRect().top - offset),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [completedSearchRequest, isSearching, resultIsStale]);

  useEffect(() => {
    const actions = actionsRef.current;
    if (!actions) return;
    let frame = 0;
    const updateVisibility = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const rect = actions.getBoundingClientRect();
        setActionsVisible(rect.width > 0 && rect.top < window.innerHeight && rect.bottom > 0);
      });
    };
    const observer = new IntersectionObserver(updateVisibility);
    observer.observe(actions);
    window.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("resize", updateVisibility);
    updateVisibility();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("resize", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (!hasRestoredSearch) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (isLoading || error || hasNoImportedData) {
        return;
      }
      if (!isTeamSelectMode && hasSavedSearchResults()) {
        return;
      }
      const request = searchRequests.current.begin("initial");
      setIsSearching(true);
      setSearchError(null);
      void searchCharacters("", CHARACTER_SEARCH_PAGE_SIZE, { matchMode: "or" })
        .then((response) => {
          if (cancelled || !searchRequests.current.isCurrent(request)) return;
          setResults(response.results);
          setTotalMatches(response.totalMatches);
          setAppliedSearchStamp(searchRequestStamp(""));
        })
        .catch((caught) => {
          if (cancelled || !searchRequests.current.isCurrent(request)) return;
          setResults([]);
          setTotalMatches(0);
          setSearchError(caught instanceof Error ? caught.message : "キャラクター検索に失敗しました。");
        })
        .finally(() => {
          if (!cancelled && searchRequests.current.isCurrent(request)) setIsSearching(false);
        });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [isLoading, error, hasNoImportedData, isTeamSelectMode, hasRestoredSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!isTeamSelectMode) {
        try {
          const raw = window.sessionStorage.getItem(CHARACTER_SEARCH_STATE_KEY);
          if (raw) {
            const saved = JSON.parse(raw) as {
              filters?: typeof filters;
              letterMatchMode?: CharacterSearchMatchMode;
              matchMode?: CharacterSearchMatchMode;
              traitMatchMode?: CharacterSearchMatchMode;
              query?: string;
              resultLimit?: number;
              results?: CharacterSearchResult[];
              totalMatches?: number;
              appliedSearchStamp?: string;
            };
            setQuery(saved.query ?? "");
            setMatchMode(saved.matchMode === "and" ? "and" : "or");
            setLetterMatchMode(saved.letterMatchMode === "and" ? "and" : "or");
            setTraitMatchMode(saved.traitMatchMode === "or" ? "or" : "and");
            if (saved.filters) setFilters(current => ({ ...current, ...saved.filters }));
            if (Array.isArray(saved.results)) setResults(saved.results);
            setTotalMatches(Number(saved.totalMatches ?? 0));
            setAppliedSearchStamp(saved.appliedSearchStamp ?? null);
            setResultLimit(Number(saved.resultLimit ?? CHARACTER_SEARCH_PAGE_SIZE));
          }
        } catch {
          window.sessionStorage.removeItem(CHARACTER_SEARCH_STATE_KEY);
        } finally {
          setHasRestoredSearch(true);
        }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isTeamSelectMode]);

  useEffect(() => {
    if (isTeamSelectMode || !hasRestoredSearch) {
      return;
    }
    const payload = {
      filters,
      letterMatchMode,
      matchMode,
      traitMatchMode,
      query,
      resultLimit,
      results,
      totalMatches,
      appliedSearchStamp,
    };
    window.sessionStorage.setItem(CHARACTER_SEARCH_STATE_KEY, JSON.stringify(payload));
  }, [filters, isTeamSelectMode, hasRestoredSearch, letterMatchMode, matchMode, traitMatchMode, query, resultLimit, results, totalMatches, appliedSearchStamp]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsCharactersPath(window.location.pathname === "/characters");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function resetFilters() {
    searchRequests.current.cancelScroll();
    setQuery("");
    setMatchMode("or");
    setLetterMatchMode("or");
    setTraitMatchMode("and");
    setTraitReset(current => current + 1);
    setFilters({
      attributes: [],
      species: [],
      leaderTraits: [],
      gimmicks: [],
      superGimmicks: [],
      groups: [],
      letters: [],
      traits: [],
      traitNames: [],
      traitCategories: [],
      rarityTypes: [],
    });
    setResultLimit(CHARACTER_SEARCH_PAGE_SIZE);
    if (!isTeamSelectMode) {
      window.sessionStorage.removeItem(CHARACTER_SEARCH_STATE_KEY);
    }
  }

  function setFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: toggle(current[key], value),
    }));
  }

  function toggleGimmickFilter(value: string) {
    if (isSuperGimmickDisplayName(value)) {
      const superValue = superGimmickValueFromDisplay(value);
      setFilters((current) => ({
        ...current,
        superGimmicks: toggle(current.superGimmicks, superValue),
      }));
      return;
    }
    setFilter("gimmicks", value);
  }

  function addToSlot(character: CharacterSearchResult, slot: DeckCharacter) {
    if (!onAddToDeckSlot) {
      return;
    }
    if (
      slot.name &&
      !window.confirm(`${slot.id}番枠の「${slot.name}」を「${character.name}」で上書きしますか？`)
    ) {
      return;
    }
    onAddToDeckSlot(character, slot.id);
  }

  return (
    <section className={`section character-search-section character-search-${mode}`}>
      <div className="section-heading">
        <h2>キャラ検索データ</h2>
        <span className="muted">
          {meta ? `キャラ総数: ${totalCharacters.toLocaleString()}件` : "読み込み確認中"}
        </span>
      </div>
      {error ? (
        <p className="status error">{error}</p>
      ) : (
        <div className="dictionary-info compact">
          <p className={`status ${hasNoImportedData ? "warning" : ""}`}>
            {isLoading
              ? "キャラクターデータの件数を確認中です。"
              : hasNoImportedData
                ? "キャラクターデータは0件です。取り込みを実行してください。"
                : "条件を選んでサーバー側で絞り込みます。"}
          </p>
        </div>
      )}

      <div className="character-filter-panel" onFocusCapture={event => {
        // Keep keyboard-focused inputs above the bottom action bar.
        const actions = actionsRef.current;
        const target = event.target as HTMLElement;
        if (!actions || actions.contains(target) || !target.getClientRects().length) return;
        const barTop = actions.getBoundingClientRect().top;
        const targetBottom = target.getBoundingClientRect().bottom;
        if (targetBottom > barTop && barTop > 0) window.scrollBy({ top: targetBottom - barTop + 16, behavior: "instant" });
      }}>
        <label className="character-search">
          <Search size={17} aria-hidden />
          <input
            disabled={isLoading || Boolean(error) || hasNoImportedData}
            value={query}
            placeholder="キャラ名、持ち文字、ギミック、種族で検索"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                void runSearch();
              }
            }}
          />
        </label>

        <div className="filter-category-list">
          <FilterCategory defaultOpen label="基本" selectedCount={basicFilterCount}>
            <div className="filter-basic-layout">
              <FilterField
                label="属性"
                options={ATTRIBUTE_OPTIONS}
                selected={filters.attributes}
                onToggle={(value) => setFilter("attributes", value)}
                optionClassName={attributeClass}
              />
              <FilterField
                label="種族"
                options={SPECIES_OPTIONS}
                selected={filters.species}
                onToggle={(value) => setFilter("species", value)}
              />
              <LetterFilterModalGroup
                letterMatchMode={letterMatchMode}
                onLetterMatchModeChange={setLetterMatchMode}
                selected={filters.letters}
                onToggle={(value) => setFilter("letters", value)}
              />
              <FilterField
                label="特殊レアリティ"
                options={[...SPECIAL_RARITY_TYPES]}
                selected={filters.rarityTypes}
                onToggle={(value) => setFilter("rarityTypes", value)}
                optionClassName={(value) => `rarity-filter-option ${rarityClass(value)}`}
              />
              <GroupFilterGroup
                originalGroups={originalGroupOptions}
                collabGroups={collabGroupOptions}
                groupDisplayNames={groupDisplayNames}
                collabGroupDisplayNames={collabGroupDisplayNames}
                selected={filters.groups}
                onToggle={(value) => setFilter("groups", value)}
              />
            </div>
          </FilterCategory>

          <FilterCategory label="ギミック対策" selectedCount={gimmickFilterCount}>
            <div className="filter-view-switch">
              <span>表示するギミック</span>
              <div className="segmented-control" role="tablist" aria-label="ギミック種別">
                <button
                  aria-selected={gimmickView === "normal"}
                  className={gimmickView === "normal" ? "selected" : ""}
                  onClick={() => setGimmickView("normal")}
                  role="tab"
                  type="button"
                >
                  通常
                </button>
                <button
                  aria-selected={gimmickView === "super"}
                  className={gimmickView === "super" ? "selected" : ""}
                  onClick={() => setGimmickView("super")}
                  role="tab"
                  type="button"
                >
                  スーパーのみ
                </button>
              </div>
            </div>
            <FilterField
              label={gimmickView === "normal" ? "通常ギミック" : "スーパーギミック"}
              options={gimmickView === "normal" ? normalGimmickOptions : superGimmickOptions}
              selected={
                gimmickView === "normal"
                  ? filters.gimmicks
                  : filters.superGimmicks.map(superGimmickDisplayName)
              }
              onToggle={toggleGimmickFilter}
            />
          </FilterCategory>

          <FilterCategory label="状態異常耐性" selectedCount={filters.leaderTraits.length}>
            <FilterField
              label="リーダーとくせい"
              options={LEADER_TRAIT_OPTIONS}
              selected={filters.leaderTraits}
              onToggle={(value) => setFilter("leaderTraits", value)}
            />
            <p className="filter-helper-text">
              個人とくせいの耐性は、下の「とくせい」から特性テンプレートを選択できます。
            </p>
          </FilterCategory>

          <FilterCategory label="とくせい" selectedCount={filters.traits.length + filters.traitNames.length + filters.traitCategories.length}>
            <TraitSearchFilters
              key={traitReset}
              names={meta?.traitNameOptions ?? []}
              categories={meta?.traitCategoryOptions ?? []}
              templates={meta?.traitOptions ?? []}
              selectedNames={filters.traitNames}
              selectedCategories={filters.traitCategories}
              selectedTemplates={filters.traits}
              matchMode={traitMatchMode}
              onName={value => setFilter("traitNames", value)}
              onCategory={value => setFilter("traitCategories", value)}
              onTemplate={value => setFilter("traits", value)}
              onMode={setTraitMatchMode}
              onClear={() => { setFilters(current => ({ ...current, traits: [], traitNames: [], traitCategories: [] })); setTraitMatchMode("and"); }}
            />
          </FilterCategory>
        </div>

        <label className="toggle-row search-mode-toggle inline-search-mode">
          <input
            checked={matchMode === "and"}
            type="checkbox"
            onChange={(event) => setMatchMode(event.target.checked ? "and" : "or")}
          />
          基本条件・詳細条件をANDで検索
        </label>

        <div className="actions filter-actions-bottom" ref={actionsRef} role="group" aria-label="キャラクター検索の操作">
          <button onClick={resetFilters} type="button">
            <RotateCcw size={16} aria-hidden />
            すべて解除
          </button>
          <button className="primary" disabled={isSearching || isLoading || Boolean(error) || hasNoImportedData} onClick={() => void runSearch(CHARACTER_SEARCH_PAGE_SIZE)} type="button">
            <Search size={16} aria-hidden />
            {isSearching ? "検索中..." : "絞り込む"}
          </button>
        </div>
      </div>

      <div className="character-results" ref={resultsRef} aria-busy={isSearching}>
        {resultIsStale && !isSearching && !isLoading ? <p className="filter-helper-text">検索条件を変更しました。「絞り込む」で結果と件数を更新してください。</p> : null}
        {isLoading ? (
          <p className="muted">メタ情報の読み込み完了後に検索できます。</p>
        ) : hasNoImportedData ? (
          <p className="muted">
            `npm run import:characters` で表示テキスト由来のキャラデータを取り込むと、ここに検索結果が出ます。
          </p>
        ) : searchError ? (
          <p className="status error">{searchError}</p>
        ) : isSearching && !isLoadingMore ? (
          <p className="status">検索中...</p>
        ) : hasNoSearchMatches ? (
          <p className="muted character-no-results" role="status">{resultIsStale ? "前回の検索では一致するキャラクターが見つかりませんでした。" : "検索条件に一致するキャラクターが見つかりませんでした。"}</p>
        ) : (
          <>
            <p className="status">
              {resultIsStale ? `前回の検索結果: ${totalMatches.toLocaleString()}件中 ${results.length.toLocaleString()}件を表示` : query.trim() || hasActiveFilters
                ? `検索結果: ${totalMatches.toLocaleString()}件中 ${results.length.toLocaleString()}件を表示 / 基本・詳細：${
                    matchMode === "and" ? "AND" : "OR"
                  }${filters.traitNames.length || filters.traitCategories.length ? ` / 特性名・効果：${traitMatchMode.toUpperCase()}` : ""}`
                : `おすすめ: 先頭${results.length.toLocaleString()}件を表示`}
            </p>
            {results.map((character) => {
              const attributes = character.attributes?.length ? character.attributes : [character.attribute];
              const primaryAttribute = attributes[0];
              const attrClass = attributes.includes("虹")
                ? "attr-rainbow"
                : attributes.length > 1
                  ? "attr-multi"
                  : attributeClass(primaryAttribute);
              const detailHref = `/characters/${encodeURIComponent(character.id)}`;
              const speciesLabel = speciesShortName(character.species || character.race);
              return (
                <article
                  className={`character-card ${attrClass} ${!isTeamSelectMode ? "clickable-card" : ""}`}
                  key={character.id}
                  onClick={() => {
                    if (!isTeamSelectMode) {
                      window.location.href = detailHref;
                    }
                  }}
                  onKeyDown={(event) => {
                    if (!isTeamSelectMode && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      window.location.href = detailHref;
                    }
                  }}
                  role={!isTeamSelectMode ? "link" : undefined}
                  style={multiAttributeStyle(attributes)}
                  tabIndex={!isTeamSelectMode ? 0 : undefined}
                  title={!isTeamSelectMode ? `${character.name}の詳細ページへ` : undefined}
                >
                  <div className="character-basic-column">
                    <div className="character-card-header">
                      <CharacterThumb
                        className="character-thumb"
                        imageUrl={character.imageUrl}
                        name={character.name}
                        placeholderClassName={`character-thumb-placeholder ${attrClass}`}
                      />
                      <div>
                        <strong>{character.name}</strong>
                        <div className="character-meta-line">
                          {attributes.map((attribute) => (
                            <span className={`attribute-badge ${attributeClass(attribute)}`} key={attribute}>
                              {attribute || "属性不明"}
                            </span>
                          ))}
                          <span className="species-badge" title={character.species || character.race || "不明"}>
                            {speciesLabel}
                          </span>
                          {character.rarityType ? (
                            <SpecialRarityBadge compact rarity={character.rarityType} />
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="tag-block character-letters-block">
                      <span className="tag-label">持ち文字</span>
                      <div className="character-tags">
                        <LetterAttributeTags letters={character.letterAttributes ?? []} />
                      </div>
                    </div>
                  </div>

                  <div className="character-detail-grid">
                    <div className="tag-block">
                      <span className="tag-label">リーダー特性</span>
                      <div className="character-tags">
                        {character.leaderTraits?.length ? (
                          character.leaderTraits.slice(0, 6).map((trait) => (
                            <span className="tag muted-tag" key={`${character.id}-${trait}`}>
                              {trait}
                            </span>
                          ))
                        ) : (
                          <span className="muted">{leaderInformationState(character) === "text_only" ? "本文取得済み・分類未登録" : "本文未取得"}</span>
                        )}
                      </div>
                    </div>
                    <div className="tag-block">
                      <span className="tag-label">ギミック耐性</span>
                      <div className="character-tags">
                        {combinedGimmickDisplayList(character.gimmicks ?? [], character.superGimmicks ?? []).length ? (
                          combinedGimmickDisplayList(character.gimmicks ?? [], character.superGimmicks ?? []).slice(0, 10).map((gimmick) => (
                            <span className="tag muted-tag" key={`${character.id}-${gimmick}`}>
                              {gimmick}
                            </span>
                          ))
                        ) : (
                          <span className="muted">未取得</span>
                        )}
                      </div>
                    </div>
                    {character.traitNames?.length ? (
                      <div className="tag-block">
                        <span className="tag-label">とくせい</span>
                        <div className="character-tags">
                          {character.traitNames.slice(0, 6).map((trait) => (
                            <span className="tag muted-tag" key={`${character.id}-${trait}`}>
                              {trait}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : character.traitsRaw?.length ? (
                      <div className="tag-block">
                        <span className="tag-label">とくせい</span>
                        <span className="muted">本文取得済み・分類未登録</span>
                      </div>
                    ) : null}
                    {character.exSkill?.name || character.exSkill?.summary ? (
                      <div className="tag-block skill-summary-block">
                        <span className="tag-label">EXスキル</span>
                        <p className="muted">
                          {character.exSkill.name ? <strong>{character.exSkill.name}</strong> : null}
                          {character.exSkill.summary ? <span>{character.exSkill.name ? " / " : ""}{character.exSkill.summary}</span> : null}
                        </p>
                      </div>
                    ) : null}
                    {character.chargeSkill?.name || character.chargeSkill?.summary ? (
                      <div className="tag-block skill-summary-block">
                        <span className="tag-label">チャージスキル</span>
                        <p className="muted">
                          {character.chargeSkill.name ? <strong>{character.chargeSkill.name}</strong> : null}
                          {character.chargeSkill.summary ? <span>{character.chargeSkill.name ? " / " : ""}{character.chargeSkill.summary}</span> : null}
                        </p>
                      </div>
                    ) : null}
                    {character.groups?.length || character.collabGroups?.length ? (
                      <div className="tag-block">
                        <span className="tag-label">グループ</span>
                        <div className="character-tags">
                          {character.groups?.map((group) => (
                            <span className="tag muted-tag" key={`${character.id}-${group}`}>
                              {groupDisplayNames[group] ?? group}
                            </span>
                          ))}
                          {character.collabGroups?.map((group) => (
                            <span className="tag muted-tag" key={`${character.id}-collab-${group}`}>
                              {collabGroupDisplayNames[group] ?? group}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {isTeamSelectMode ? (
                    <div className="deck-add-controls">
                      <button
                        className="primary compact-button"
                        disabled={character.letters.length === 0 || !onAddToNextEmpty}
                        onClick={() => onAddToNextEmpty?.(character)}
                      >
                        <Plus size={15} aria-hidden />
                        次の空き枠
                      </button>
                      <div className="slot-buttons" aria-label={`${character.name}の登録先`}>
                        {deck.map((slot) => (
                          <button
                            className={`slot-button ${slot.name ? "occupied" : ""} ${
                              slot.id === 1 ? "leader" : ""
                            }`}
                            disabled={character.letters.length === 0}
                            key={`${character.id}-${slot.id}`}
                            title={slot.name ? `${slot.id}番: ${slot.name}` : `${slot.id}番: 空き枠`}
                            onClick={() => addToSlot(character, slot)}
                          >
                            <span>{slot.id === 1 ? "L" : slot.id}</span>
                            {slot.name ? <small>{truncateName(slot.name)}</small> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
            {results.length < totalMatches ? (
              <div className="load-more-row">
                <button
                  className="primary"
                  disabled={isSearching}
                  onClick={() => void runSearch(Math.min(totalMatches, results.length + CHARACTER_SEARCH_PAGE_SIZE), "more")}
                  type="button"
                >
                  {isLoadingMore ? "読み込み中..." : `もっと見る（${results.length.toLocaleString()} / ${totalMatches.toLocaleString()}）`}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
      {!isTeamSelectMode && isCharactersPath && !actionsVisible ? (
        <button
          className="back-to-top-button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          type="button"
        >
          最上部へ
        </button>
      ) : null}
    </section>
  );
}
