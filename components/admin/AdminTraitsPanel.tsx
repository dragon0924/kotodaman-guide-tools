"use client";

import { Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TRAIT_PARAM_TYPES } from "@/lib/traits";
import type { TraitMasterFile, TraitParamType, TraitTemplate, TraitTemplateParam } from "@/lib/types";

type TraitAdminResponse = TraitMasterFile & {
  path: string;
  candidateFiles?: {
    traitTemplateCandidates?: CandidateFile;
    blessingTraitTemplateCandidates?: CandidateFile;
    unmatchedTraitTemplateCandidates?: CandidateFile;
    traitTemplateMatches?: TraitMatchFile;
    unmatchedCompositeTraitParts?: CandidateFile;
    compositeTraitRowCandidates?: CandidateFile;
  };
};

type CandidateFile = {
  meta?: Record<string, unknown>;
  candidates?: TraitCandidateRow[];
};

type TraitMatchFile = {
  meta?: Record<string, unknown>;
  matches?: TraitTemplateMatchRow[];
};

type TraitTemplateMatchRow = {
  characterId: string;
  characterName: string;
  sourceType: "trait" | "blessingTrait";
  rawText: string;
  matchedTemplateId?: string;
  matchedTemplateName?: string;
  params?: Record<string, string>;
  confidence?: "high" | "medium" | "low";
  status: "matched" | "unmatched" | "ambiguous";
  notes?: string[];
};

type TraitCandidateRow = {
  sourceType?: "trait" | "blessingTrait";
  rawText?: string;
  normalizedText?: string;
  count?: number;
  exampleCharacterNames?: string[];
  suggestedTemplateName?: string;
  guessedTemplateName?: string;
  suggestedPattern?: string;
  guessedParams?: unknown[];
  suggestedParamKeys?: string[];
  confidence?: string;
  difficulty?: "easy" | "medium" | "hard";
  reason?: string;
  notes?: string[] | string;
};

type DisplayCandidateRow = TraitCandidateRow & {
  id: string;
  sourceLabel: "通常特性" | "祝福特性";
  origin: string;
  isExistingLike: boolean;
};

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

function emptyTemplate(): TraitTemplate {
  return {
    id: "",
    name: "",
    template: "",
    params: [],
  };
}

function emptyParam(): TraitTemplateParam {
  return {
    key: "",
    label: "",
    type: "text",
    required: true,
  };
}

function normalizeTemplates(templates: TraitTemplate[]) {
  return templates.map((template) => ({
    ...template,
    id: template.id.trim(),
    name: template.name.trim(),
    template: template.template.trim(),
    params: template.params.map((param) => ({
      ...param,
      key: param.key.trim(),
      label: param.label.trim(),
    })),
  }));
}

function stringifyNotes(value: TraitCandidateRow["notes"]) {
  if (Array.isArray(value)) return value.filter(Boolean).join(" / ");
  return value ?? "";
}

function candidateSourceType(row: TraitCandidateRow, fallback: "trait" | "blessingTrait") {
  return row.sourceType === "trait" || row.sourceType === "blessingTrait" ? row.sourceType : fallback;
}

function candidateTitle(row: TraitCandidateRow) {
  return row.suggestedTemplateName || row.guessedTemplateName || row.normalizedText || row.rawText || "名称未設定";
}

function candidatePattern(row: TraitCandidateRow) {
  return row.suggestedPattern || row.normalizedText || row.rawText || "";
}

function buildCandidateRows(data: TraitAdminResponse, currentTemplates: TraitTemplate[]): DisplayCandidateRow[] {
  const existingPatterns = new Set(
    currentTemplates.flatMap((template) =>
      [template.pattern, template.template, template.name].map((value) => value?.trim()).filter(Boolean),
    ),
  );
  const rows: DisplayCandidateRow[] = [];
  const append = (
    origin: string,
    file: CandidateFile | undefined,
    fallbackSourceType: "trait" | "blessingTrait",
  ) => {
    for (const [index, row] of (file?.candidates ?? []).entries()) {
      const sourceType = candidateSourceType(row, fallbackSourceType);
      const pattern = candidatePattern(row).trim();
      const name = candidateTitle(row).trim();
      rows.push({
        ...row,
        sourceType,
        id: `${origin}-${sourceType}-${index}-${pattern || name}`,
        sourceLabel: sourceType === "blessingTrait" ? "祝福特性" : "通常特性",
        origin,
        isExistingLike: Boolean((pattern && existingPatterns.has(pattern)) || (name && existingPatterns.has(name))),
      });
    }
  };
  append("通常候補", data.candidateFiles?.traitTemplateCandidates, "trait");
  append("祝福候補", data.candidateFiles?.blessingTraitTemplateCandidates, "blessingTrait");
  append("未一致分析", data.candidateFiles?.unmatchedTraitTemplateCandidates, "trait");
  return rows.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
}

export function AdminTraitsPanel({ adminPassword }: { adminPassword: string }) {
  const [templates, setTemplates] = useState<TraitTemplate[]>([]);
  const [path, setPath] = useState("data/traitMaster.json");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [candidateRows, setCandidateRows] = useState<DisplayCandidateRow[]>([]);
  const [candidateSourceFilter, setCandidateSourceFilter] = useState<"all" | "trait" | "blessingTrait">("all");
  const [candidateDifficultyFilter, setCandidateDifficultyFilter] = useState<"all" | "easy" | "medium" | "hard">("all");
  const [candidateQuery, setCandidateQuery] = useState("");
  const [matchRows, setMatchRows] = useState<TraitTemplateMatchRow[]>([]);
  const [matchSourceFilter, setMatchSourceFilter] = useState<"all" | "trait" | "blessingTrait">("all");
  const [matchStatusFilter, setMatchStatusFilter] = useState<"all" | "matched" | "unmatched" | "ambiguous">("all");
  const [matchTemplateFilter, setMatchTemplateFilter] = useState("all");
  const [matchQuery, setMatchQuery] = useState("");

  const selected = templates[selectedIndex] ?? null;

  const loadTraits = useCallback(async (secret: string) => {
    setError("");
    setStatus("");
    const response = await requestAdmin("/api/admin/traits", secret);
    if (!response.ok) {
      setError(response.status === 401 ? "認証に失敗しました。ADMIN_PASSWORD を確認してください。" : await response.text());
      return;
    }
    const data = (await response.json()) as TraitAdminResponse;
    setPath(data.path);
    setTemplates(data.templates ?? []);
    setCandidateRows(buildCandidateRows(data, data.templates ?? []));
    setMatchRows(data.candidateFiles?.traitTemplateMatches?.matches ?? []);
    setSelectedIndex(0);
    setStatus(`読み込み完了: ${data.templates?.length ?? 0}件`);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTraits(adminPassword);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [adminPassword, loadTraits]);

  function updateSelected(patch: Partial<TraitTemplate>) {
    setTemplates((current) =>
      current.map((template, index) => index === selectedIndex ? { ...template, ...patch } : template),
    );
  }

  function updateParam(paramIndex: number, patch: Partial<TraitTemplateParam>) {
    if (!selected) {
      return;
    }
    updateSelected({
      params: selected.params.map((param, index) => index === paramIndex ? { ...param, ...patch } : param),
    });
  }

  function addTemplate() {
    setTemplates((current) => [...current, emptyTemplate()]);
    setSelectedIndex(templates.length);
  }

  function deleteSelected() {
    if (!selected || !window.confirm(`「${selected.name || selected.id || "未設定"}」を削除しますか？`)) {
      return;
    }
    setTemplates((current) => current.filter((_, index) => index !== selectedIndex));
    setSelectedIndex(0);
  }

  async function save() {
    setError("");
    setStatus("保存中...");
    const payload: TraitMasterFile = {
      templates: normalizeTemplates(templates),
    };
    const response = await requestAdmin("/api/admin/traits", adminPassword, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      setStatus("");
      setError(await response.text());
      return;
    }
    const data = (await response.json()) as TraitAdminResponse;
    setTemplates(data.templates ?? []);
    setCandidateRows(buildCandidateRows(data, data.templates ?? []));
    setMatchRows(data.candidateFiles?.traitTemplateMatches?.matches ?? []);
    setPath(data.path);
    await fetch("/api/characters/meta?refresh=1", { cache: "no-store" });
    setStatus(`保存しました: ${data.path}`);
  }

  const filteredCandidateRows = useMemo(() => {
    const query = candidateQuery.trim().toLowerCase();
    return candidateRows
      .filter((row) => candidateSourceFilter === "all" || row.sourceType === candidateSourceFilter)
      .filter((row) => candidateDifficultyFilter === "all" || row.difficulty === candidateDifficultyFilter)
      .filter((row) => {
        if (!query) return true;
        return [
          row.rawText,
          row.normalizedText,
          row.suggestedTemplateName,
          row.guessedTemplateName,
          row.suggestedPattern,
          row.reason,
          stringifyNotes(row.notes),
          ...(row.exampleCharacterNames ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .slice(0, 200);
  }, [candidateRows, candidateDifficultyFilter, candidateQuery, candidateSourceFilter]);

  const matchTemplateOptions = useMemo(() => {
    return [...new Set([
      ...templates.map((template) => template.name).filter(Boolean),
      ...matchRows.map((row) => row.matchedTemplateName).filter((name): name is string => Boolean(name)),
    ])]
      .sort((a, b) => a.localeCompare(b, "ja"));
  }, [matchRows, templates]);

  const filteredMatchRows = useMemo(() => {
    const query = matchQuery.trim().toLowerCase();
    return matchRows.filter((row) => {
      if (matchSourceFilter !== "all" && row.sourceType !== matchSourceFilter) return false;
      if (matchStatusFilter !== "all" && row.status !== matchStatusFilter) return false;
      if (matchTemplateFilter !== "all" && row.matchedTemplateName !== matchTemplateFilter) return false;
      if (!query) return true;
      return [
        row.characterName,
        row.rawText,
        row.matchedTemplateName,
        row.matchedTemplateId,
        JSON.stringify(row.params ?? {}),
        ...(row.notes ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [matchQuery, matchRows, matchSourceFilter, matchStatusFilter, matchTemplateFilter]);

  const displayedMatchRows = useMemo(() => filteredMatchRows.slice(0, 500), [filteredMatchRows]);

  const matchTemplateSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of filteredMatchRows) {
      if (!row.matchedTemplateName) continue;
      counts.set(row.matchedTemplateName, (counts.get(row.matchedTemplateName) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
  }, [filteredMatchRows]);

  return (
    <section className="admin-traits-manager">
      <div className="section-heading">
        <div>
          <h1>特性管理</h1>
          <p className="muted">キャラごとの数値や属性を入れ替えられる特性テンプレートを管理します。</p>
        </div>
        <span className="tag muted-tag">{path}</span>
      </div>

      <div className="actions admin-group-actions">
        <button className="primary" onClick={save} type="button">
          <Save size={16} aria-hidden />
          保存
        </button>
        <button onClick={() => void loadTraits(adminPassword)} type="button">
          <RotateCcw size={16} aria-hidden />
          リセット
        </button>
        <button onClick={addTemplate} type="button">
          <Plus size={16} aria-hidden />
          テンプレート追加
        </button>
        <button disabled={!selected} onClick={deleteSelected} type="button">
          <Trash2 size={16} aria-hidden />
          削除
        </button>
      </div>

      {status ? <p className="status">{status}</p> : null}
      {error ? <p className="status error">{error}</p> : null}

      <section className="admin-panel trait-guide-panel">
        <h2>特性テンプレートの入力ガイド</h2>
        <p>
          テンプレート名は管理しやすい名前、template はキャラごとに変わる値を
          <code>{"{key}"}</code> で埋め込む表示文です。key は template 内の
          <code>{"{attribute}"}</code> や <code>{"{percent}"}</code> と対応する英数字、
          label は編集画面に出す項目名、type は入力方法です。
        </p>
        <div className="trait-guide-example">
          <strong>入力例</strong>
          <ul>
            <li>テンプレート名: 属性ATKUP</li>
            <li>template: <code>{"{attribute}属性ATK{percent}%UP"}</code></li>
            <li>params: key = attribute / label = 属性 / type = attribute</li>
            <li>params: key = percent / label = 倍率 / type = number</li>
            <li>プレビュー: 火属性ATK100%UP</li>
          </ul>
        </div>
      </section>

      <section className="admin-panel trait-candidate-panel">
        <div className="section-heading compact-heading">
          <div>
            <h2>テンプレート候補</h2>
            <p className="muted">
              集計済みJSONから、テンプレート化できそうな特性候補を count 順で確認します。ここでは traitMaster へ自動追加しません。
            </p>
          </div>
          <span className="tag muted-tag">{candidateRows.length}件</span>
        </div>
        <div className="admin-editor-grid">
          <label>
            種別
            <select
              value={candidateSourceFilter}
              onChange={(event) => setCandidateSourceFilter(event.target.value as typeof candidateSourceFilter)}
            >
              <option value="all">すべて</option>
              <option value="trait">通常特性</option>
              <option value="blessingTrait">祝福特性</option>
            </select>
          </label>
          <label>
            難易度
            <select
              value={candidateDifficultyFilter}
              onChange={(event) => setCandidateDifficultyFilter(event.target.value as typeof candidateDifficultyFilter)}
            >
              <option value="all">すべて</option>
              <option value="easy">easy</option>
              <option value="medium">medium</option>
              <option value="hard">hard</option>
            </select>
          </label>
          <label className="wide">
            検索
            <input
              placeholder="normalizedText / rawText / 候補名で検索"
              value={candidateQuery}
              onChange={(event) => setCandidateQuery(event.target.value)}
            />
          </label>
        </div>
        <div className="trait-candidate-list">
          {filteredCandidateRows.length ? filteredCandidateRows.map((row) => (
            <article className="trait-candidate-card" key={row.id}>
              <div className="trait-candidate-card-header">
                <div>
                  <strong>{candidateTitle(row)}</strong>
                  <p className="muted">{row.normalizedText || row.rawText}</p>
                </div>
                <div className="trait-candidate-badges">
                  <span className="tag">{row.sourceLabel}</span>
                  <span className="tag muted-tag">{row.origin}</span>
                  <span className="tag">{row.count ?? 0}件</span>
                  {row.difficulty ? <span className="tag">{row.difficulty}</span> : null}
                  {row.confidence ? <span className="tag">{row.confidence}</span> : null}
                  {row.isExistingLike ? <span className="tag success-tag">既存候補</span> : null}
                </div>
              </div>
              <dl className="trait-candidate-details">
                <div>
                  <dt>rawText</dt>
                  <dd>{row.rawText || "-"}</dd>
                </div>
                <div>
                  <dt>pattern</dt>
                  <dd>{candidatePattern(row) || "-"}</dd>
                </div>
                <div>
                  <dt>params</dt>
                  <dd>{row.suggestedParamKeys?.join(", ") || row.guessedParams?.map((param) => JSON.stringify(param)).join(" / ") || "-"}</dd>
                </div>
                <div>
                  <dt>examples</dt>
                  <dd>{row.exampleCharacterNames?.slice(0, 8).join("、") || "-"}</dd>
                </div>
                <div>
                  <dt>reason / notes</dt>
                  <dd>{row.reason || stringifyNotes(row.notes) || "-"}</dd>
                </div>
              </dl>
            </article>
          )) : (
            <p className="muted">条件に一致する候補はありません。</p>
          )}
        </div>
      </section>

      <section className="admin-panel trait-candidate-panel">
        <div className="section-heading compact-heading">
          <div>
            <h2>テンプレート一致結果</h2>
            <p className="muted">
              raw特性とtraitMasterの一致結果を確認します。フィルタ後 {filteredMatchRows.length.toLocaleString()}件 / 表示 {displayedMatchRows.length.toLocaleString()}件
            </p>
          </div>
          <span className="tag muted-tag">全 {matchRows.length.toLocaleString()}件</span>
        </div>

        <div className="admin-editor-grid">
          <label>
            特性種別
            <select
              value={matchSourceFilter}
              onChange={(event) => setMatchSourceFilter(event.target.value as typeof matchSourceFilter)}
            >
              <option value="all">すべて</option>
              <option value="trait">通常特性</option>
              <option value="blessingTrait">祝福特性</option>
            </select>
          </label>
          <label>
            一致状態
            <select
              value={matchStatusFilter}
              onChange={(event) => setMatchStatusFilter(event.target.value as typeof matchStatusFilter)}
            >
              <option value="all">すべて</option>
              <option value="matched">matched</option>
              <option value="unmatched">unmatched</option>
              <option value="ambiguous">ambiguous</option>
            </select>
          </label>
          <label>
            テンプレート
            <select value={matchTemplateFilter} onChange={(event) => setMatchTemplateFilter(event.target.value)}>
              <option value="all">すべて</option>
              {matchTemplateOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="wide">
            検索
            <input
              placeholder="rawText / キャラ名 / テンプレート名 / params"
              value={matchQuery}
              onChange={(event) => setMatchQuery(event.target.value)}
            />
          </label>
        </div>

        {matchTemplateSummary.length ? (
          <div className="trait-candidate-badges" aria-label="テンプレート別件数">
            {matchTemplateSummary.map(([name, count]) => (
              <button
                className={matchTemplateFilter === name ? "tag active" : "tag"}
                key={name}
                onClick={() => setMatchTemplateFilter((current) => current === name ? "all" : name)}
                type="button"
              >
                {name} {count.toLocaleString()}
              </button>
            ))}
          </div>
        ) : null}

        <div className="trait-candidate-list">
          {displayedMatchRows.length ? displayedMatchRows.map((row, index) => (
            <article className="trait-candidate-card" key={`${row.characterId}-${row.sourceType}-${index}-${row.rawText}`}>
              <div className="trait-candidate-card-header">
                <div>
                  <strong>{row.characterName}</strong>
                  <p>{row.rawText}</p>
                </div>
                <div className="trait-candidate-badges">
                  <span className="tag">{row.sourceType === "blessingTrait" ? "祝福特性" : "通常特性"}</span>
                  <span className="tag muted-tag">{row.status}</span>
                  {row.confidence ? <span className="tag">{row.confidence}</span> : null}
                </div>
              </div>
              <dl className="trait-candidate-details">
                <div>
                  <dt>template</dt>
                  <dd>{row.matchedTemplateName || "-"}</dd>
                </div>
                <div>
                  <dt>params</dt>
                  <dd>
                    {Object.keys(row.params ?? {}).length ? (
                      <span className="trait-candidate-badges">
                        {Object.entries(row.params ?? {}).map(([key, value]) => (
                          <span className="tag" key={key}><strong>{key}:</strong> {value || "(空)"}</span>
                        ))}
                      </span>
                    ) : "空"}
                  </dd>
                </div>
                <div>
                  <dt>notes</dt>
                  <dd>{row.notes?.join(" / ") || "-"}</dd>
                </div>
              </dl>
            </article>
          )) : (
            <p className="muted">条件に一致するテンプレート結果はありません。</p>
          )}
        </div>
      </section>

      <div className="admin-trait-layout">
        <aside className="admin-panel admin-trait-list">
          <h2>テンプレート一覧</h2>
          {templates.length ? (
            templates.map((template, index) => (
              <button
                className={index === selectedIndex ? "active" : ""}
                key={`${template.id}-${index}`}
                onClick={() => setSelectedIndex(index)}
                type="button"
              >
                <strong>{template.name || "名称未設定"}</strong>
                <small>{template.id || "id未設定"}</small>
              </button>
            ))
          ) : (
            <p className="muted">テンプレートがありません。</p>
          )}
        </aside>

        <section className="admin-panel admin-trait-editor">
          {selected ? (
            <>
              <div className="admin-editor-grid">
                <label>
                  ID
                  <input value={selected.id} onChange={(event) => updateSelected({ id: event.target.value })} />
                </label>
                <label>
                  テンプレート名
                  <input value={selected.name} onChange={(event) => updateSelected({ name: event.target.value })} />
                </label>
                <label className="wide">
                  テンプレート
                  <input value={selected.template} onChange={(event) => updateSelected({ template: event.target.value })} />
                </label>
              </div>

              <div className="admin-edit-section">
                <div className="section-heading compact-heading">
                  <h3>パラメータ</h3>
                  <button
                    onClick={() => updateSelected({ params: [...selected.params, emptyParam()] })}
                    type="button"
                  >
                    <Plus size={15} aria-hidden />
                    追加
                  </button>
                </div>
                <div className="admin-trait-param-list">
                  {selected.params.length ? (
                    selected.params.map((param, index) => (
                      <div className="admin-trait-param-row" key={`param-${index}`}>
                        <input
                          aria-label="key"
                          placeholder="key"
                          value={param.key}
                          onChange={(event) => updateParam(index, { key: event.target.value })}
                        />
                        <input
                          aria-label="label"
                          placeholder="ラベル"
                          value={param.label}
                          onChange={(event) => updateParam(index, { label: event.target.value })}
                        />
                        <select
                          value={param.type}
                          onChange={(event) => updateParam(index, { type: event.target.value as TraitParamType })}
                        >
                          {TRAIT_PARAM_TYPES.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                        <label className="toggle-row compact-toggle">
                          <input
                            checked={Boolean(param.required)}
                            type="checkbox"
                            onChange={(event) => updateParam(index, { required: event.target.checked })}
                          />
                          必須
                        </label>
                        <button
                          onClick={() => updateSelected({ params: selected.params.filter((_, paramIndex) => paramIndex !== index) })}
                          type="button"
                        >
                          削除
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="muted">パラメータなし</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="muted">テンプレートを追加または選択してください。</p>
          )}
        </section>
      </div>
    </section>
  );
}
