"use client";

import { useId, useState } from "react";
import { normalizeTraitName, splitTraitSearchKey, traitSearchKey, TRAIT_SOURCE_LABELS, TRAIT_SOURCES, type TraitSearchOption, type TraitSearchSource } from "@/lib/traitSearch";

type Props = {
  names: TraitSearchOption[]; categories: TraitSearchOption[]; templates: string[];
  selectedNames: string[]; selectedCategories: string[]; selectedTemplates: string[];
  matchMode: "and" | "or";
  onName: (key: string) => void; onCategory: (key: string) => void; onTemplate: (key: string) => void;
  onMode: (mode: "and" | "or") => void; onClear: () => void;
};
const COMMON = ["看破", "応援", "牽制", "援護", "反撃", "確定反撃", "モード・シフト", "ダメージ上限突破", "文字変換"];
function templateSource(name: string): TraitSearchSource {
  return name.startsWith("祝福：") ? "blessing" : name.startsWith("大討伐条件：") ? "raid" : "normal";
}

export function TraitSearchFilters(props: Props) {
  const modeGroup = useId();
  const [source, setSource] = useState<TraitSearchSource>("normal");
  const [query, setQuery] = useState(""); const [detailQuery, setDetailQuery] = useState("");
  const tokens = query.trim().split(/\s+/u).filter(Boolean).map(normalizeTraitName);
  const available = props.names.filter(n => n.counts[source] > 0);
  const visible = available.filter(n => !tokens.length || tokens.some(token => [n.label, ...n.aliases].some(label => normalizeTraitName(label).toLowerCase().includes(token.toLowerCase()))));
  const common = visible.filter(n => COMMON.includes(n.label));
  const others = visible.filter(n => !COMMON.includes(n.label));
  const details = props.templates.filter(t => templateSource(t) === source && t.includes(detailQuery.trim()));
  const selectedCount = props.selectedNames.length + props.selectedCategories.length + props.selectedTemplates.length;
  const optionButton = (n: TraitSearchOption, category = false) => {
    const key = traitSearchKey(source, n.label); const selected = (category ? props.selectedCategories : props.selectedNames).includes(key);
    return <button key={key} type="button" aria-pressed={selected} className={selected ? "selected" : ""} onClick={() => category ? props.onCategory(key) : props.onName(key)}><span>{n.label}</span><small>{n.counts[source]}</small></button>;
  };
  return <div className="trait-search-panel">
    <div className="trait-source-tabs" role="tablist" aria-label="とくせい種別">
      {TRAIT_SOURCES.map(tab => <button key={tab} role="tab" aria-selected={source === tab} type="button" className={source === tab ? "selected" : ""} onClick={() => setSource(tab)}>{TRAIT_SOURCE_LABELS[tab]}特性</button>)}
    </div>
    <div className="trait-search-controls">
      <label>特性名から探す<input type="search" value={query} placeholder="看破、応援、モードシフトなど" onChange={e => setQuery(e.target.value)} /></label>
      <p className="filter-helper-text">入力で名称候補を絞り込み、名称を選択してください。空白で複数の候補名を探せます。</p>
      <div className="trait-name-options" aria-label="一般的な特性名">{common.map(n => optionButton(n))}</div>
      {tokens.length ? <div className="trait-name-options" aria-label="特性名の候補">{others.map(n => optionButton(n))}</div> : <details className="trait-option-disclosure"><summary>すべての特性名（{available.length}種類）</summary><div className="trait-name-options">{others.map(n => optionButton(n))}</div></details>}
      {!visible.length ? <p className="muted">この種別に一致する名称はありません。効果カテゴリや詳細条件でも探せます。</p> : null}
      <p className="filter-helper-text">名称・カテゴリの件数は、各項目だけで検索したキャラ数です。条件を選択後、画面下の「絞り込む」で結果を更新します。</p>
      <fieldset className="trait-category-options"><legend>効果から探す</legend><div className="trait-name-options">{props.categories.filter(n => n.counts[source] > 0).map(n => optionButton(n, true))}</div></fieldset>
      <fieldset className="trait-mode-options"><legend>名称・カテゴリの組み合わせ</legend>
        <label><input type="radio" name={modeGroup} checked={props.matchMode === "and"} onChange={() => props.onMode("and")} />すべて所持（AND）</label>
        <label><input type="radio" name={modeGroup} checked={props.matchMode === "or"} onChange={() => props.onMode("or")} />いずれか所持（OR）</label>
      </fieldset>
      <p className="filter-helper-text">異なる種別の選択も保持します。名称・カテゴリの条件は、基本条件・詳細条件で絞った結果とANDで組み合わせます。</p>
      <details className="trait-option-disclosure"><summary>詳細条件検索（既存テンプレート）</summary>
        <p className="filter-helper-text">発動条件・対象属性・種族・強化対象を含む既存分類です。本文の数値を指定する機能はありません。</p>
        <label>詳細条件を絞り込む<input type="search" value={detailQuery} onChange={e => setDetailQuery(e.target.value)} placeholder="ドロー時、状態異常耐性など" /></label>
        <div className="trait-detail-options">{details.map(name => <label key={name}><input type="checkbox" checked={props.selectedTemplates.includes(name)} onChange={() => props.onTemplate(name)} /><span>{name}</span></label>)}</div>
        {!details.length ? <p className="muted">この種別に一致する詳細条件はありません。</p> : null}
      </details>
      <div className="trait-selected-conditions" aria-live="polite">
        <strong>選択中：{selectedCount}件</strong>
        {props.selectedNames.map(key => { const k = splitTraitSearchKey(key); return <button key={key} type="button" onClick={() => props.onName(key)} aria-label={`${TRAIT_SOURCE_LABELS[k.source]} ${k.label}を解除`}>{TRAIT_SOURCE_LABELS[k.source]}：{k.label} ×</button>; })}
        {props.selectedCategories.map(key => { const k = splitTraitSearchKey(key); return <button key={key} type="button" onClick={() => props.onCategory(key)} aria-label={`${TRAIT_SOURCE_LABELS[k.source]} カテゴリ ${k.label}を解除`}>{TRAIT_SOURCE_LABELS[k.source]}・効果：{k.label} ×</button>; })}
        {props.selectedTemplates.map(name => <button key={name} type="button" onClick={() => props.onTemplate(name)} aria-label={`詳細 ${name}を解除`}>詳細：{name} ×</button>)}
      </div>
      <button type="button" onClick={() => { props.onClear(); setQuery(""); setDetailQuery(""); }}>とくせい条件を全解除</button>
    </div>
  </div>;
}
