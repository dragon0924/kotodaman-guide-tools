"use client";

import { Plus, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { searchCharacters } from "@/lib/characters";
import type { CharacterSearchResult, QuestCharacterRecommendation, QuestFile, QuestRecord } from "@/lib/types";

const QUEST_TYPES = ["降臨", "その他"];
const ATTRIBUTE_OPTIONS = ["火", "水", "木", "光", "闇", "冥", "天", "虹"];
const DIFFICULTY_OPTIONS = ["中級", "上級", "超級", "魔級", "破滅級", "その他"];
const STATUS_AILMENT_OPTIONS = ["毒", "混乱", "睡眠", "呪い", "汚染", "炎上", "改造", "衰弱", "変異", "消去"];
const GIMMICK_OPTIONS = [
  "シールド",
  "トゲ",
  "チェンジ",
  "弱体",
  "ウォール",
  "ビリビリ",
  "ヒール",
  "コピー",
  "地雷",
  "フリーズ",
  "バルーン",
  "スマッシュ",
];
const REWARD_OPTIONS = ["虹のコトダマ", "満葉打破", "コトワリ", "専用おめで鯛", "その他アイテム"];
const ROLE_OPTIONS = ["アタッカー", "回復", "ギミック対策", "状態異常対策", "EXスキル目的", "文字要員", "その他"];

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

function emptyQuest(): QuestRecord {
  return {
    questId: `quest-${Date.now().toString(36)}`,
    questName: "",
    type: "降臨",
    questType: "降臨",
    enemyAttributes: [],
    difficulties: [],
    statusAilments: [],
    gimmicks: [],
    obtainableCharacterIds: [],
    clearRewards: [],
    bestLeaderIds: [],
    recommendedLeaderIds: [],
    bestSubCharacters: [],
    recommendedSubCharacters: [],
    boardPatterns: [],
    strategyText: "",
    sourceUrl: "",
    memo: "",
  };
}

function toggle(values: string[] | undefined, value: string) {
  const set = new Set(values ?? []);
  if (set.has(value)) {
    set.delete(value);
  } else {
    set.add(value);
  }
  return [...set];
}

function splitLines(value: string) {
  return value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
}

function joinLines(values: string[] | undefined) {
  return (values ?? []).join("\n");
}

function CharacterPicker({
  label,
  selectedIds,
  characters,
  characterLookup,
  showCandidates,
  onChange,
}: {
  label: string;
  selectedIds: string[];
  characters: CharacterSearchResult[];
  characterLookup: Map<string, CharacterSearchResult>;
  showCandidates: boolean;
  onChange: (ids: string[]) => void;
}) {
  const selected = selectedIds.map((id) => characterLookup.get(id) ?? ({ id, name: id } as CharacterSearchResult));
  return (
    <div className="admin-relation-picker">
      <strong>{label}</strong>
      <div className="admin-chip-list">
        {selected.length ? selected.map((character) => (
          <button className="tag removable-tag" key={character.id} onClick={() => onChange(selectedIds.filter((id) => id !== character.id))} type="button">
            {character.name}<span aria-hidden>×</span>
          </button>
        )) : <span className="muted">未選択</span>}
      </div>
      {showCandidates ? (
        <div className="admin-character-pick-grid compact-results">
          {characters.map((character) => {
            const active = selectedIds.includes(character.id);
            return (
              <button
                className={active ? "chip active" : "chip"}
                key={character.id}
                onClick={() => onChange(toggle(selectedIds, character.id))}
                type="button"
              >
                {character.imageUrl ? <img alt="" src={character.imageUrl} /> : null}
                <span>{character.name}</span>
              </button>
            );
          })}
        </div>
      ) : <p className="muted">上のキャラ検索から候補を表示して選択できます。</p>}
    </div>
  );
}

function SubCharacterEditor({
  title,
  rows,
  characters,
  onChange,
}: {
  title: string;
  rows: QuestCharacterRecommendation[];
  characters: CharacterSearchResult[];
  onChange: (rows: QuestCharacterRecommendation[]) => void;
}) {
  function updateRow(index: number, patch: Partial<QuestCharacterRecommendation>) {
    onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  return (
    <div className="admin-sub-character-editor">
      <div className="admin-inline-heading">
        <strong>{title}</strong>
        <button
          onClick={() => onChange([...rows, { characterId: characters[0]?.id ?? "", role: "アタッカー", memo: "" }])}
          type="button"
        >
          <Plus size={14} aria-hidden />追加
        </button>
      </div>
      {rows.length ? rows.map((row, index) => (
        <div className="admin-sub-character-row" key={`${row.characterId}-${index}`}>
          <select value={row.characterId} onChange={(event) => updateRow(index, { characterId: event.target.value })}>
            <option value="">キャラを選択</option>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>{character.name}</option>
            ))}
          </select>
          <select value={row.role ?? ""} onChange={(event) => updateRow(index, { role: event.target.value })}>
            <option value="">役割</option>
            {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <input
            placeholder="メモ"
            value={row.memo ?? ""}
            onChange={(event) => updateRow(index, { memo: event.target.value })}
          />
          <button onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))} type="button">
            <Trash2 size={14} aria-hidden />削除
          </button>
        </div>
      )) : <p className="muted">未登録</p>}
    </div>
  );
}

export function AdminQuestsPanel({ adminPassword }: { adminPassword: string }) {
  const [quests, setQuests] = useState<QuestRecord[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [path, setPath] = useState("data/quests.json");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [characterQuery, setCharacterQuery] = useState("");
  const [characterOptions, setCharacterOptions] = useState<CharacterSearchResult[]>([]);
  const [characterLookup, setCharacterLookup] = useState<Map<string, CharacterSearchResult>>(() => new Map());

  const selected = quests[selectedIndex] ?? null;
  const showCharacterCandidates = characterQuery.trim().length > 0 && characterOptions.length > 0;

  const loadQuests = useCallback(async () => {
    setStatus("");
    setError("");
    const response = await requestAdmin("/api/admin/quests", adminPassword);
    if (!response.ok) {
      setError(response.status === 401 ? "認証に失敗しました。" : await response.text());
      return;
    }
    const data = (await response.json()) as QuestFile & { path: string };
    setQuests(data.quests ?? []);
    setPath(data.path);
    setSelectedIndex(0);
    setStatus(`読み込み完了: ${(data.quests ?? []).length.toLocaleString()}件`);
  }, [adminPassword]);

  const runCharacterSearch = useCallback(async (query = characterQuery) => {
    setError("");
    try {
      const response = await searchCharacters(query, 40, { matchMode: "or" });
      setCharacterOptions(response.results);
      setCharacterLookup((current) => {
        const next = new Map(current);
        response.results.forEach((character) => next.set(character.id, character));
        return next;
      });
      setStatus(`キャラ候補: ${response.totalMatches.toLocaleString()}件`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "キャラ検索に失敗しました。");
    }
  }, [characterQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadQuests();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadQuests]);

  function updateSelected(patch: Partial<QuestRecord>) {
    setQuests((current) => current.map((quest, index) => index === selectedIndex ? { ...quest, ...patch } : quest));
  }

  function addQuest() {
    setQuests((current) => [...current, emptyQuest()]);
    setSelectedIndex(quests.length);
  }

  function deleteQuest() {
    if (!selected || !window.confirm(`${selected.questName || selected.questId || "未設定"}を削除しますか？`)) {
      return;
    }
    setQuests((current) => current.filter((_, index) => index !== selectedIndex));
    setSelectedIndex(0);
  }

  async function save() {
    setStatus("保存中...");
    setError("");
    const payload: QuestFile = {
      quests: quests
        .map((quest) => ({
          ...quest,
          questId: quest.questId.trim(),
          questName: quest.questName.trim(),
          type: (quest.type ?? quest.questType ?? "降臨").trim(),
          questType: (quest.type ?? quest.questType ?? "降臨").trim(),
        }))
        .filter((quest) => quest.questId && quest.questName),
    };
    const response = await requestAdmin("/api/admin/quests", adminPassword, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      setStatus("");
      setError(await response.text());
      return;
    }
    const data = (await response.json()) as QuestFile & { path: string };
    setQuests(data.quests ?? []);
    setPath(data.path);
    setStatus(`保存しました: ${data.path}`);
  }

  return (
    <section className="admin-quests-manager">
      <div className="section-heading">
        <div>
          <h1>クエスト管理</h1>
          <p className="muted">攻略用のクエスト情報、登場ギミック、適正キャラ、盤面、攻略メモを管理します。</p>
          <p><a href="/admin?tab=articles">クエスト攻略記事の共通テンプレート・Tiptap編集は記事管理へ</a></p>
        </div>
        <span className="tag muted-tag">{path}</span>
      </div>

      <div className="actions admin-group-actions">
        <button className="primary" onClick={save} type="button"><Save size={16} aria-hidden />保存</button>
        <button onClick={() => void loadQuests()} type="button"><RotateCcw size={16} aria-hidden />再読み込み</button>
        <button onClick={addQuest} type="button"><Plus size={16} aria-hidden />追加</button>
        <button disabled={!selected} onClick={deleteQuest} type="button"><Trash2 size={16} aria-hidden />削除</button>
      </div>

      {status ? <p className="status">{status}</p> : null}
      {error ? <p className="status error">{error}</p> : null}

      <div className="admin-trait-layout">
        <aside className="admin-panel admin-trait-list">
          <h2>クエスト一覧</h2>
          {quests.length ? quests.map((quest, index) => (
            <button
              className={index === selectedIndex ? "active" : ""}
              key={`${quest.questId}-${index}`}
              onClick={() => setSelectedIndex(index)}
              type="button"
            >
              <strong>{quest.questName || "名称未設定"}</strong>
              <small>{quest.questId || "ID未設定"}</small>
            </button>
          )) : <p className="muted">クエストがありません。</p>}
        </aside>

        <section className="admin-panel admin-trait-editor">
          <div className="admin-character-search-row">
            <label>
              キャラ検索
              <input
                placeholder="入手キャラ・適正キャラを検索"
                value={characterQuery}
                onChange={(event) => setCharacterQuery(event.target.value)}
              />
            </label>
            <button onClick={() => void runCharacterSearch()} type="button"><Search size={16} aria-hidden />検索</button>
          </div>

          {selected ? (
            <div className="admin-editor-grid">
              <label>
                クエストID
                <input value={selected.questId} onChange={(event) => updateSelected({ questId: event.target.value })} />
              </label>
              <label>
                クエスト名
                <input value={selected.questName} onChange={(event) => updateSelected({ questName: event.target.value })} />
              </label>
              <label>
                種別
                <select value={selected.type ?? selected.questType ?? "降臨"} onChange={(event) => updateSelected({ type: event.target.value, questType: event.target.value })}>
                  {QUEST_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <div className="admin-field-group">
                <strong>敵属性</strong>
                <div className="filter-chip-grid compact">
                  {ATTRIBUTE_OPTIONS.map((attribute) => (
                    <button
                      className={(selected.enemyAttributes ?? []).includes(attribute) ? "chip active" : "chip"}
                      key={attribute}
                      onClick={() => {
                        const enemyAttributes = toggle(selected.enemyAttributes, attribute);
                        updateSelected({ enemyAttributes, enemyAttribute: enemyAttributes[0] ?? "" });
                      }}
                      type="button"
                    >
                      {attribute}
                    </button>
                  ))}
                </div>
              </div>

              <div className="wide admin-field-group">
                <strong>難易度</strong>
                <div className="filter-chip-grid compact">
                  {DIFFICULTY_OPTIONS.map((difficulty) => (
                    <button
                      className={(selected.difficulties ?? []).includes(difficulty) ? "chip active" : "chip"}
                      key={difficulty}
                      onClick={() => updateSelected({ difficulties: toggle(selected.difficulties, difficulty) })}
                      type="button"
                    >
                      {difficulty}
                    </button>
                  ))}
                </div>
                <textarea
                  aria-label="難易度を改行区切りで編集"
                  value={joinLines(selected.difficulties)}
                  onChange={(event) => updateSelected({ difficulties: splitLines(event.target.value) })}
                />
              </div>

              <div className="wide admin-field-group">
                <strong>登場状態異常</strong>
                <div className="filter-chip-grid compact">
                  {STATUS_AILMENT_OPTIONS.map((item) => (
                    <button className={(selected.statusAilments ?? []).includes(item) ? "chip active" : "chip"} key={item} onClick={() => updateSelected({ statusAilments: toggle(selected.statusAilments, item) })} type="button">{item}</button>
                  ))}
                </div>
              </div>

              <div className="wide admin-field-group">
                <strong>登場ギミック</strong>
                <div className="filter-chip-grid compact">
                  {GIMMICK_OPTIONS.map((item) => (
                    <button className={(selected.gimmicks ?? []).includes(item) ? "chip active" : "chip"} key={item} onClick={() => updateSelected({ gimmicks: toggle(selected.gimmicks, item) })} type="button">{item}</button>
                  ))}
                </div>
              </div>

              <CharacterPicker
                characters={characterOptions}
                characterLookup={characterLookup}
                label="クエストクリアで入手可能なキャラクター"
                selectedIds={selected.obtainableCharacterIds ?? []}
                showCandidates={showCharacterCandidates}
                onChange={(ids) => updateSelected({ obtainableCharacterIds: ids })}
              />

              <div className="wide admin-field-group">
                <strong>クリア報酬</strong>
                <div className="filter-chip-grid compact">
                  {REWARD_OPTIONS.map((reward) => (
                    <button className={(selected.clearRewards ?? []).includes(reward) ? "chip active" : "chip"} key={reward} onClick={() => updateSelected({ clearRewards: toggle(selected.clearRewards, reward) })} type="button">{reward}</button>
                  ))}
                </div>
                <textarea
                  aria-label="クリア報酬を改行区切りで編集"
                  value={joinLines(selected.clearRewards)}
                  onChange={(event) => updateSelected({ clearRewards: splitLines(event.target.value) })}
                />
              </div>

              <CharacterPicker
                characters={characterOptions}
                characterLookup={characterLookup}
                label="最適性リーダー"
                selectedIds={selected.bestLeaderIds ?? []}
                showCandidates={showCharacterCandidates}
                onChange={(ids) => updateSelected({ bestLeaderIds: ids })}
              />
              <CharacterPicker
                characters={characterOptions}
                characterLookup={characterLookup}
                label="おすすめリーダー"
                selectedIds={selected.recommendedLeaderIds ?? []}
                showCandidates={showCharacterCandidates}
                onChange={(ids) => updateSelected({ recommendedLeaderIds: ids })}
              />

              <div className="wide admin-field-group">
                <SubCharacterEditor
                  characters={characterOptions}
                  rows={selected.bestSubCharacters ?? []}
                  title="最適性サブ"
                  onChange={(rows) => updateSelected({ bestSubCharacters: rows })}
                />
                <SubCharacterEditor
                  characters={characterOptions}
                  rows={selected.recommendedSubCharacters ?? []}
                  title="おすすめサブ"
                  onChange={(rows) => updateSelected({ recommendedSubCharacters: rows })}
                />
              </div>

              <label className="wide">
                盤面パターン（改行区切り）
                <textarea value={joinLines(selected.boardPatterns)} onChange={(event) => updateSelected({ boardPatterns: splitLines(event.target.value) })} />
              </label>
              <label className="wide">
                攻略
                <textarea value={selected.strategyText ?? ""} onChange={(event) => updateSelected({ strategyText: event.target.value })} />
              </label>
              <label className="wide">
                sourceUrl
                <input value={selected.sourceUrl ?? ""} onChange={(event) => updateSelected({ sourceUrl: event.target.value })} />
              </label>
              <label className="wide">
                memo
                <textarea value={selected.memo ?? ""} onChange={(event) => updateSelected({ memo: event.target.value })} />
              </label>

              {characterLookup.size ? <p className="wide muted">キャラ候補は検索欄で絞り込めます。選択済みIDは保存時にそのまま保持されます。</p> : null}
            </div>
          ) : <p className="muted">クエストを追加または選択してください。</p>}
        </section>
      </div>
    </section>
  );
}
