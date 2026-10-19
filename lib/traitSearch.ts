import type { CharacterRecord, CharacterTraitEntry, TraitTemplate } from "./types";
import { renderTrait } from "./traits.ts";
import { applyCharacterDetailRecoveries, type CharacterDetailRecovery } from "./characterDetailRecovery.ts";

export type TraitSearchSource = "normal" | "blessing" | "raid";
export type TraitSearchOption = { label: string; aliases: string[]; counts: Record<TraitSearchSource, number> };
export type TraitSearchEvidence = {
  characterId: string; characterName: string; sourceUrl: string; source: TraitSearchSource;
  file: string; field: "traitsRaw" | "blessingTraitsRaw" | "traits" | "headings"; index: number;
  rawText: string; segment: string; names: string[]; categories: string[]; rule: string;
};
export type TraitSearchIndex = {
  names: TraitSearchOption[]; categories: TraitSearchOption[]; evidence: TraitSearchEvidence[];
  unresolved: Array<Omit<TraitSearchEvidence, "names" | "categories" | "rule"> & { reason: string }>;
  characterCount: number; charactersWithText: number;
};
export const TRAIT_SEARCH_RULE_VERSION = 4;
export type ReviewedTraitSearchSource = {
  characterId: string; characterName: string; sourceUrl: string; source: "normal";
  headings: string[]; checkedAt: string;
};
export function parseReviewedTraitSearchSources(value: unknown): ReviewedTraitSearchSource[] {
  const file = value as { version?: unknown; entries?: ReviewedTraitSearchSource[] } | null;
  if (file?.version !== 1 || !Array.isArray(file.entries)) throw new Error("Invalid reviewed trait search sources");
  const seen = new Set<string>();
  for (const entry of file.entries) {
    if (!entry || ![entry.characterId, entry.characterName, entry.sourceUrl, entry.checkedAt].every(v => typeof v === "string" && v.trim())
      || entry.source !== "normal" || !Array.isArray(entry.headings) || !entry.headings.length
      || !entry.headings.every(v => typeof v === "string" && v.trim()) || seen.has(entry.characterId)) throw new Error("Invalid or duplicate reviewed trait search source");
    seen.add(entry.characterId);
  }
  return file.entries;
}
export const TRAIT_SOURCES: TraitSearchSource[] = ["normal", "blessing", "raid"];
export const TRAIT_SOURCE_LABELS = { normal: "通常", blessing: "祝福", raid: "大討伐" };
const NAME_ALIASES: Record<string, string[]> = { "モード・シフト": ["モードシフト", "モード シフト"] };
const NUMBERED = /^[①-⑳]/u;
const EMPTY = /^(?:効果(?:[（(]最大強化時[）)])?|なし|福ブースト表|福|倍率|[0-9０-９~～\-]+|満|(?:EX)?祝福(?:特性|とくせい)(?:なし)?)$/u;

export function normalizeTraitName(value: string) {
  const text = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const alias = Object.entries(NAME_ALIASES).find(([label, aliases]) => [label, ...aliases].some(v => v.normalize("NFKC") === text))?.[0];
  if (alias) return alias;
  const explicit = headingText(text) ? explicitNames(text) : [];
  return explicit.length === 1 ? explicit[0] : text;
}

/** Split only outside quoted targets/parentheses. Keep the explicitly named mode together. */
export function splitTraitHeading(text: string) {
  const value = text.replaceAll("モード・シフト", "モード＿シフト").replace(/[火水木光闇天冥虹全](?:・[火水木光闇天冥虹全])+(?:属性)/gu, v => v.replaceAll("・", "＿")).replace(/[神英龍物獣霊魔妖](?:・[神英龍物獣霊魔妖])+(?:種族)/gu, v => v.replaceAll("・", "＿"));
  const parts: string[] = []; let start = 0; const closers: string[] = [];
  const pairs: Record<string, string> = { "「": "」", "『": "』", "【": "】", "（": "）", "(": ")", "“": "”" };
  for (let i = 0; i < value.length; i += 1) {
    if (pairs[value[i]]) closers.push(pairs[value[i]]);
    else if (value[i] === closers.at(-1) || /[)）]/u.test(value[i]) && /[)）]/u.test(closers.at(-1) ?? "")) closers.pop();
    else if (!closers.length && /[・＆&]/u.test(value[i])) { parts.push(value.slice(start, i)); start = i + 1; }
  }
  parts.push(value.slice(start));
  return parts.map(v => v.replaceAll("＿", "・").trim()).filter(Boolean);
}

function headingText(text: string) {
  return !NUMBERED.test(text) && !/[。\n\t]|(?:場合|する|され|与える|受ける|受けない|できる|基礎値を|ダメージを|効果を|自身の|ドロー時に|実体化時に)/u.test(text);
}

// Explicit title vocabulary, including the infrequent proper names observed in the full dataset.
// Their effects are never used to give another trait the same name.
const LITERAL_NAMES = [
  "心眼回避", "応急手当", "オーバーヒール", "ヒーロー活動", "ヴィジランテ活動", "変身", "変化：黒閃", "変化：協和", "変化の術",
  "堕天", "心の怪盗団", "ファミリアの絆", "ドラゴンスケール", "A.T.フィールド", "三国の願い", "新たなる希望", "真なる共鳴", "聖夜の奇跡",
  "マハタルカジャ", "マハラクカジャ", "弱点発見", "『夢』への旅路", "レーザーブースター", "デュエルモード", "織盛日輪", "内なる闇", "芽生えし邪悪",
  "ブレイブステップ", "夏の思い出", "途絶の氷剣", "イージスの金", "不変の志", "闇中の極光", "エナジーシャワー", "金色の鼻", "緋の眼", "神託の鎧",
  "マジ殴り", "根絶の叫焔", "天憂の銀弾", "シンゴウスピア", "インターロック", "ナマハゲゴーグル", "シャリンドリル", "パワードモード", "生滅の邪眼",
  "神託の盾", "断絶の飄風", "秘めたる光", "正義の萌芽", "神託の扇", "天憂の加護", "火の滅竜魔導士", "アナライズ", "精密射撃", "ハイパーカウンタ",
  "黒い粒子", "不可侵の美", "神託の兜", "生死の狭間", "確定反撃", "閃亜の双眼", "報道のペン", "神託の剣", "素早さの心得", "ムドブースタ", "ディア", "残像", "解毒剤", "テトラブレイク",
];
const GIMMICKS = ["トゲガード", "ビリビリガード", "チェンジガード", "弱体ガード", "コピーガード", "地雷ガード", "バルーンガード", "レーザーガード", "シールドブレイカー", "ウォールブレイカー", "ヒールブレイカー", "フリーズブレイカー", "スマッシュブレイカー"];

function explicitNames(segment: string): string[] {
  const names = new Set<string>();
  const text = segment.normalize("NFKC");
  const quoted = text.match(/^(?:デッキ条件|大討伐条件)?[「『](看破|応援|牽制)[」』](?=$|敵全体被ダメ|(?:[「『][^」』]+[」』]|味方|[火水木光闇天冥虹全・]+属性|[神英龍物獣霊魔妖・]+種族)ATK)/u);
  if (quoted) names.add(quoted[1]);
  if (/^(?:看破|応援|牽制)$/u.test(text)) names.add(text);
  if (/^(?:デッキ条件|大討伐条件)?援護(?:\([^)]*\))?$/u.test(text)) names.add("援護");
  if (/^反撃(?:\(|[0-9]|$)/u.test(text)) names.add("反撃");
  if (/^確定反撃\(すごわざ[0-9]+%\)$/u.test(text)) names.add("確定反撃");
  if (/^モード[・ ]?シフト$/u.test(text)) names.add("モード・シフト");
  if (/^(?:デッキ条件|大討伐条件)?(?:サブ属性)?文字変換[「(]/u.test(text)) names.add(text.includes("サブ属性文字変換") ? "サブ属性文字変換" : "文字変換");
  // These are literal title families, not names inferred from a similar effect.
  if (/^(?:(?:デッキ条件|大討伐条件|自身|味方全体|[火水木光闇天冥虹全]+属性|[神英龍物獣霊魔妖]+種族|単発攻撃|重圧|敵全体|被)+)?ダメージ上限突破\(/u.test(text)) names.add("ダメージ上限突破");
  const killer = text.match(/^(?:スーパー)?([火水木光闇天冥虹全]+属性|[神英龍物獣霊魔妖]+種族)キラー(?:[+0-9◯○]|$)/u);
  if (killer) names.add((text.startsWith("スーパー") ? "スーパー" : "") + killer[1] + "キラー");
  const resistance = text.match(/^(?:デッキ条件)?(毒|睡眠|混乱|呪い|汚染|炎上|衰弱)耐性(?:[0-9◯○]|$)/u);
  if (resistance) names.add(resistance[1] + "耐性");
  const reduction = text.match(/^([火水木光闇天冥虹全]+属性)ダメージ(?:[0-9%]+)?軽減(?:[+0-9◯○]|$)/u);
  if (reduction) names.add(reduction[1] + "ダメージ軽減");
  for (const stat of ["HP", "ATK"]) if (new RegExp(`^${stat}基礎値(?:小|中|大|極大|超|[0-9]+)?(?:UP|アップ)$`, "u").test(text)) names.add(stat + "基礎値UP");
  if (/^(?:デッキ条件|大討伐条件)?コンボ\+[0-9]+/u.test(text)) names.add("コンボ+");
  if (/^(?:デッキ条件)?バリア貫通[0-9%]/u.test(text)) names.add("バリア貫通");
  if (/^(?:デッキ条件)?ヒールコアギミック(?:小|中|大)?\(/u.test(text)) names.add("ヒールコアギミック");
  if (/^回復効果(?:小|中|大|極大)?UP$/u.test(text)) names.add("回復効果UP");
  for (const name of GIMMICKS) {
    for (const prefix of ["", "スーパー"]) if (new RegExp(`^(?:デッキ条件)?${prefix}${name}(?:\\((?:福|[0-9]+)\\)|「[ぁ-ゖ・]+」)?$`, "u").test(text)) names.add(prefix + name);
  }
  for (const name of LITERAL_NAMES) if (text === name.normalize("NFKC") || (name === "心眼回避" && /^心眼回避[0-9]+%$/u.test(text)) || (name === "応急手当" && /^応急手当\s*(?:弱|強|極)$/u.test(text))) names.add(name);
  return [...names];
}

export const TRAIT_EFFECT_CATEGORIES = ["ギミック対策", "キラー", "耐性", "ATK強化", "HP強化", "ダメージ上限突破", "被ダメージ増加", "文字変換", "回復", "編成条件", "ドロー時効果", "実体化時効果", "反撃"];
function effectCategories(text: string, names: string[]) {
  const value = text.normalize("NFKC"); const categories: string[] = [];
  if (names.some(n => /ガード|ブレイカー$/u.test(n))) categories.push("ギミック対策");
  if (names.some(n => n.endsWith("キラー"))) categories.push("キラー");
  if (/(?:毒|睡眠|混乱|呪い|汚染|炎上|衰弱)(?:耐性|状態.*無効)/u.test(value)) categories.push("耐性");
  if (/ATK(?:を|の|基礎値|\s|[0-9%小中大極])*?(?:UP|アップ|強化|上昇)/iu.test(value)) categories.push("ATK強化");
  if (/HP(?:を|の|基礎値|\s|[0-9%小中大極])*?(?:UP|アップ|強化|上昇)/iu.test(value)) categories.push("HP強化");
  if (/ダメージ(?:の)?上限(?:突破|を[0-9]+増加)/u.test(value)) categories.push("ダメージ上限突破");
  if (/被ダメ(?:ージ)?(?:を|少し|大きく|状態|小|中|大|\s)*増加/u.test(value)) categories.push("被ダメージ増加");
  if (/文字変換/u.test(value)) categories.push("文字変換");
  if (/HP(?:を|が|の|[0-9%\s])*回復|回復効果|応急手当|オーバーヒール/u.test(value)) categories.push("回復");
  if (/デッキ条件|デッキ内に|デッキに.*(?:編成|いる)/u.test(value)) categories.push("編成条件");
  if (/ドロー時/u.test(value)) categories.push("ドロー時効果");
  if (/実体化時/u.test(value)) categories.push("実体化時効果");
  if (/^確定反撃(?:\(すごわざ[0-9]+%\))?$|攻撃を受けた場合に[0-9%の確率技で]*反撃する/u.test(value)) categories.push("反撃");
  return categories;
}

function effectiveTraitRecords(auto: Partial<CharacterRecord>[], manual: Partial<CharacterRecord>[], recoveries: CharacterDetailRecovery[]) {
  const records = new Map<string, Partial<CharacterRecord>>(); const idKeys = new Map<string, string>();
  const origins = new Map<string, Record<string, string>>();
  const keyFor = (c: Partial<CharacterRecord>) => `${c.name?.trim() ?? ""}::${c.sourceUrl?.trim() ?? ""}`;
  for (const c of auto) { const key = keyFor(c); records.set(key, c); if (c.id) idKeys.set(c.id, key); origins.set(key, { traitsRaw: "data/characters.json", blessingTraitsRaw: "data/characters.json", traits: "data/characters.json" }); }
  for (const c of manual) {
    const key = (c.id && idKeys.get(c.id)) || keyFor(c); const previous = records.get(key);
    records.set(key, { ...previous, ...c });
    const origin = origins.get(key) ?? {}; for (const field of ["traitsRaw", "blessingTraitsRaw", "traits"]) if (Object.hasOwn(c, field)) origin[field] = "data/characters.manual.json";
    origins.set(key, origin); if (c.id) idKeys.set(c.id, key);
  }
  const rows = [...records];
  const recovered = applyCharacterDetailRecoveries(rows.map(([, c]) => c), recoveries, manual);
  const appliedById = new Map(recovered.applied.map(entry => [entry.characterId, entry.fields]));
  return rows.map(([key], index) => {
    const origin = { ...origins.get(key) };
    const character = recovered.characters[index];
    for (const field of appliedById.get(character.id ?? "") ?? []) origin[field] = "data/characterDetailRecoveries.json";
    return { character, origins: origin };
  });
}

export function buildTraitSearchIndex(auto: Partial<CharacterRecord>[], manual: Partial<CharacterRecord>[], templates: TraitTemplate[], reviewedSources: ReviewedTraitSearchSource[] = [], recoveries: CharacterDetailRecovery[] = []): TraitSearchIndex {
  const evidence: TraitSearchEvidence[] = []; const unresolved: TraitSearchIndex["unresolved"] = [];
  const records = effectiveTraitRecords(auto, manual, recoveries); let charactersWithText = 0;
  const reviewedById = new Map(reviewedSources.map(entry => [entry.characterId, entry]));
  for (const { character: c, origins } of records) {
    if (!c.id) continue;
    const inputs: Array<{field: TraitSearchEvidence["field"]; index: number; raw: string; source: TraitSearchSource; structured: boolean; file?: string}> = [];
    for (const field of ["traitsRaw", "blessingTraitsRaw"] as const) for (const [index, raw] of (c[field] ?? []).entries()) inputs.push({ field, index, raw, source: field === "traitsRaw" ? "normal" : "blessing", structured: false });
    for (const [index, trait] of (c.traits ?? []).entries()) {
      const t = typeof trait === "string" ? undefined : templates.find(t => t.id === trait.templateId);
      inputs.push({ field: "traits", index, raw: renderTrait(trait as CharacterTraitEntry, templates), source: t?.name.startsWith("大討伐条件：") ? "raid" : t?.sourceType === "blessingTrait" ? "blessing" : "normal", structured: typeof trait !== "string" });
    }
    const reviewed = reviewedById.get(c.id);
    // Only reviewed, identity-matched headers fill an absent raw field. Explicit empty overrides remain authoritative.
    if (reviewed && !Object.hasOwn(c, "traitsRaw") && reviewed.characterName === c.name && reviewed.sourceUrl === c.sourceUrl) {
      for (const [index, raw] of reviewed.headings.entries()) inputs.push({ field: "headings", index, raw, source: reviewed.source, structured: false, file: "data/traitSearchReviewedSources.json" });
    }
    if (inputs.some(i => i.raw.trim() && !EMPTY.test(i.raw.trim()))) charactersWithText += 1;
    for (const input of inputs) for (const line of input.raw.split(/\r?\n/u).map(l => l.trim()).filter(l => l && !EMPTY.test(l))) {
      const title = !input.structured && !NUMBERED.test(line) && !/[。\n\t]/u.test(line) && splitTraitHeading(line).some(headingText);
      const segments = title ? splitTraitHeading(line) : [line.replace(NUMBERED, "")];
      for (const segment of segments) {
        const source = input.source === "normal" && /^大討伐(?:条件|の場合|時|に)/u.test(segment) ? "raid" : input.source;
        const names = title && headingText(segment) ? explicitNames(segment.replace(/^大討伐条件/u, "")) : [];
        // Expand explicitly combined guards/breakers only when the shared suffix is present.
        if (title && /(?:＆|&)/u.test(line)) {
          const combined = line.match(/((?:スーパー)?(?:シールド|ウォール|ヒール|フリーズ|スマッシュ|トゲ|ビリビリ|弱体|コピー|チェンジ|レーザー|地雷|バルーン))(?:＆|&)((?:スーパー)?(?:シールド|ウォール|ヒール|フリーズ|スマッシュ|トゲ|ビリビリ|弱体|コピー|チェンジ|レーザー|地雷|バルーン))(ブレイカー|ガード)/u);
          if (combined && segment === combined[1] && GIMMICKS.includes((combined[1] + combined[3]).replace(/^スーパー/u, ""))) names.push(combined[1] + combined[3]);
        }
        const categories = effectCategories(segment, names);
        const base = { characterId: c.id, characterName: c.name ?? "", sourceUrl: c.sourceUrl ?? "", source, file: input.file ?? origins[input.field] ?? "data/characters.manual.json", field: input.field, index: input.index, rawText: input.raw, segment };
        if (names.length || categories.length) evidence.push({ ...base, names, categories, rule: title ? "explicit-title-v1" : "explicit-effect-v1" });
        if (title && !names.length) unresolved.push({ ...base, reason: categories.length ? "効果・条件は明記されているが独立した名称を確定しない" : "未対応の見出し・表・複合断片。名称を推測しない" });
      }
    }
  }
  const options = (field: "names" | "categories") => [...new Set(evidence.flatMap(e => e[field]))].sort((a,b) => a.localeCompare(b,"ja")).map(label => ({ label, aliases: field === "names" ? [...new Set([...(NAME_ALIASES[label] ?? []), ...evidence.filter(e => e.names.length === 1 && e.names[0] === label && e.segment !== label && e.segment.length <= 100).map(e => e.segment)])] : [], counts: Object.fromEntries(TRAIT_SOURCES.map(source => [source, new Set(evidence.filter(e => e.source === source && e[field].includes(label)).map(e => e.characterId)).size])) as Record<TraitSearchSource, number> }));
  return { names: options("names"), categories: options("categories"), evidence, unresolved, characterCount: records.length, charactersWithText };
}

export type TraitSearchCharacterIndex = Map<string, Record<TraitSearchSource, { names: Set<string>; categories: Set<string> }>>;
export function indexTraitSearchEvidence(file: TraitSearchIndex): TraitSearchCharacterIndex {
  const index: TraitSearchCharacterIndex = new Map();
  for (const e of file.evidence) {
    const entry = index.get(e.characterId) ?? { normal: { names: new Set<string>(), categories: new Set<string>() }, blessing: { names: new Set<string>(), categories: new Set<string>() }, raid: { names: new Set<string>(), categories: new Set<string>() } };
    e.names.forEach(name => entry[e.source].names.add(normalizeTraitName(name))); e.categories.forEach(category => entry[e.source].categories.add(category)); index.set(e.characterId, entry);
  }
  return index;
}

/** Compact audit snapshot: references point to original fields; no duplicated character text. */
export function compactTraitSearchIndex(file: TraitSearchIndex) {
  const grouped = new Map<string, { characterId: string; source: TraitSearchSource; names: string[]; categories: string[]; references: Array<{ file: string; field: string; index: number }> }>();
  for (const e of file.evidence) {
    const key = `${e.characterId}:${e.source}`;
    const row = grouped.get(key) ?? { characterId: e.characterId, source: e.source, names: [], categories: [], references: [] };
    row.names = [...new Set([...row.names, ...e.names])]; row.categories = [...new Set([...row.categories, ...e.categories])];
    if (!row.references.some(r => r.file === e.file && r.field === e.field && r.index === e.index)) row.references.push({ file: e.file, field: e.field, index: e.index });
    grouped.set(key, row);
  }
  return { names: file.names, categories: file.categories, characterCount: file.characterCount, charactersWithText: file.charactersWithText, unresolvedRows: file.unresolved.length, unresolvedSegments: new Set(file.unresolved.map(e => e.segment)).size, entries: [...grouped.values()] };
}
export function traitSearchKey(source: TraitSearchSource, label: string) { return `${source}:${label}`; }
export function splitTraitSearchKey(value: string, source: TraitSearchSource = "normal") {
  const colon = value.indexOf(":"); const prefix = value.slice(0, colon);
  return colon > 0 && TRAIT_SOURCES.includes(prefix as TraitSearchSource) ? { source: prefix as TraitSearchSource, label: value.slice(colon + 1) } : { source, label: value };
}
export function matchesTraitSearch(entry: ReturnType<TraitSearchCharacterIndex["get"]>, names: string[] = [], categories: string[] = [], mode: "and" | "or" = "and", source: TraitSearchSource = "normal") {
  const conditions = [...names.map(value => { const key = splitTraitSearchKey(value, source); return !!entry?.[key.source].names.has(normalizeTraitName(key.label)); }), ...categories.map(value => { const key = splitTraitSearchKey(value, source); return !!entry?.[key.source].categories.has(key.label); })];
  return !conditions.length || (mode === "and" ? conditions.every(Boolean) : conditions.some(Boolean));
}
