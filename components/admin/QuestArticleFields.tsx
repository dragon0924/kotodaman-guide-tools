"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Article, ArticleImage, ArticleQuest, QuestArticleAxis, QuestArticleMechanic, QuestArticleSectionKey, QuestArticleWave, QuestReviewKey, QuestReviewState } from "@/lib/types";
import type { ArticleCharacterLink } from "@/components/ArticleContent";
import { CharacterArticleCard } from "@/components/RichArticleBody";
import { ArticleMediaImage } from "@/components/ArticleMediaImage";
import { QUEST_AILMENTS, QUEST_ATTRIBUTE_OPTIONS, QUEST_AXIS_OPTIONS, QUEST_BOMB_KINDS, QUEST_COUNTER_TAGS, QUEST_DIFFICULTIES, QUEST_GIMMICKS, QUEST_IMPORTANCE, QUEST_MECHANIC_CATEGORIES, QUEST_OCCURRENCE, QUEST_REVIEW_LABELS, QUEST_REVIEW_REQUIRED, QUEST_REVIEW_STATES, QUEST_SECTIONS, QUEST_SPECIES_OPTIONS, questAxisText, questAxisValues, questInputIssues, questReviewProgress } from "@/lib/questArticle";
import { ArticleCharacterPicker } from "./ArticleCharacterPicker";
import { ArticleImageWidthFields } from "./ArticleImageWidthFields";
import { questWaves } from "@/lib/questArticleLayout";
import { clearMissingQuestEnemyReferences, questEnemyPositionText } from "@/lib/questEnemyLayout";
import { QuestWaveEnemiesFields } from "./QuestWaveEnemiesFields";

const id = () => crypto.randomUUID();
function TextField({ label, value, onChange, multiline = false, type = "text", list }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; type?: string; list?: string }) {
  return <label>{label}{multiline ? <textarea rows={3} value={value} onChange={e => onChange(e.target.value)}/> : <input type={type} list={list} value={value} onChange={e => onChange(e.target.value)}/>}</label>;
}
function NumberField({ label, value, onChange, min = 0 }: { label: string; value?: number; onChange: (v: number | undefined) => void; min?: number }) {
  return <label>{label}<input type="number" min={min} step={1} value={value ?? ""} onChange={e => onChange(e.target.value === "" ? undefined : Number(e.target.value))}/></label>;
}
function LinesField({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  return <TextField multiline label={label + "（1行1項目）"} value={value.join("\n")} onChange={v => onChange(v === "" ? [] : v.split(/\r?\n/u))}/>;
}
function SelectField<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return <label>{label}<select value={value} onChange={e => onChange(e.target.value as T)}>{Object.entries(options).map(([key, name]) => <option value={key} key={key}>{name as string}</option>)}</select></label>;
}
function CustomSelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void }) {
  const [custom, setCustom] = useState(false);
  const showCustom = custom || !!value && !options.includes(value);
  return <div className="quest-custom-choice"><label>{label}<select value={showCustom ? "custom" : value ? "option:" + value : ""} onChange={e => {
    if (e.target.value === "custom") setCustom(true);
    else { setCustom(false); onChange(e.target.value.replace(/^option:/u, "")); }
  }}><option value="">未選択</option>{options.map(option => <option key={option} value={"option:" + option}>{option}</option>)}<option value="custom">その他（自由入力）</option></select></label>
    {showCustom && <TextField label={label + "・その他の名称"} value={value} onChange={onChange}/>}
  </div>;
}
function MultiChoiceField({ label, value, options, onChange }: { label: string; value: string[]; options: readonly string[]; onChange: (v: string[]) => void }) {
  const [custom, setCustom] = useState("");
  const choices = [...new Set([...options, ...value])];
  function addCustom() { const next = custom.trim(); if (next && !value.includes(next)) onChange([...value, next]); setCustom(""); }
  return <fieldset className="quest-choice-field"><legend>{label}（複数選択可）</legend><div className="quest-choice-options">{choices.map(option => <label className="quest-choice-chip" key={option}><input type="checkbox" checked={value.includes(option)} onChange={e => onChange(e.target.checked ? [...value, option] : value.filter(v => v !== option))}/><span>{option || "（空欄の保存値）"}</span></label>)}</div>
    <details className="quest-choice-custom"><summary>その他の{label.replace(/^敵の/u, "")}を追加</summary><div className="quest-custom-add"><label>追加する{label}<input value={custom} onChange={e => setCustom(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); addCustom(); } }}/></label><button type="button" disabled={!custom.trim() || value.includes(custom.trim())} onClick={addCustom}>追加</button></div></details>
  </fieldset>;
}
function QuestAxisField({quest,onChange}:{quest:ArticleQuest;onChange:(axes:QuestArticleAxis[])=>void}) {
  const selected=questAxisValues(quest),legacy=quest.axes===undefined&&(quest.axis==="mixed"||quest.axis==="other");
  return <fieldset className="quest-choice-field"><legend>文字軸（複数選択可）</legend><div className="quest-choice-options">{(Object.entries(QUEST_AXIS_OPTIONS) as [QuestArticleAxis,string][]).map(([key,label])=><label className="quest-choice-chip" key={key}><input type="checkbox" checked={selected.includes(key)} onChange={e=>onChange(e.target.checked?[...selected,key]:selected.filter(axis=>axis!==key))}/><span>{label}</span></label>)}</div>
    <small>未選択の場合は「未確認」と表示します。</small>{legacy?<div><p className="muted">以前の登録：{questAxisText(quest)}。選択し直すまで保存値と表示を保持します。</p><button type="button" onClick={()=>onChange([])}>旧形式の軸を解除</button></div>:null}
  </fieldset>;
}
function ReferenceChoices({label,rows,value,onChange}:{label:string;rows:{id:string;name:string}[];value:string[];onChange:(ids:string[])=>void}) {
  return <fieldset className="quest-choice-field"><legend>{label}</legend>{rows.length?<div className="quest-choice-options">{rows.map(r=><label className="quest-choice-chip" key={r.id}><input type="checkbox" checked={value.includes(r.id)} onChange={e=>onChange(e.target.checked?[...value,r.id]:value.filter(id=>id!==r.id))}/>{r.name||"名称未入力"}</label>)}</div>:<p className="muted">先に共通項目を登録してください。</p>}</fieldset>;
}
function Rows<T extends { id: string }>({ label, rows, onChange, onAdd, children }: { label: string; rows: T[]; onChange: (rows: T[]) => void; onAdd: () => void; children: (row: T, patch: (v: Partial<T>) => void, index: number) => ReactNode }) {
  function move(index: number, direction: number) { const copy = [...rows], [row] = copy.splice(index, 1); copy.splice(index + direction, 0, row); onChange(copy); }
  return <div className="quest-field-rows">{rows.map((row, index) => <fieldset className="quest-field-row" key={row.id}><legend>{label} {index + 1}</legend>
    <div className="quest-row-actions"><button type="button" aria-label={`${label} ${index + 1}を上へ`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label={`${label} ${index + 1}を下へ`} disabled={index === rows.length - 1} onClick={() => move(index, 1)}>↓</button><button type="button" onClick={() => onChange(rows.filter(r => r.id !== row.id))}>{label}を削除</button></div>
    <div className="quest-field-grid">{children(row, patch => onChange(rows.map(r => r.id === row.id ? { ...r, ...patch } : r)), index)}</div>
  </fieldset>)}<button type="button" disabled={rows.length >= 300} onClick={onAdd}>＋ {label}を追加</button></div>;
}
const reviewSection: Record<QuestReviewKey, QuestArticleSectionKey> = { overview: "overview", enemies: "overview", gimmicks: "hazards", ailments: "hazards", boards: "boards", bombs: "bombs", characters: "characters", teams: "teams", phases: "phases" };
export function QuestInputCheck({ quest, onChange, onFocus }: { quest: ArticleQuest; onChange: (quest: ArticleQuest) => void; onFocus: (key: QuestArticleSectionKey) => void }) {
  const progress = questReviewProgress(quest), issues = questInputIssues(quest);
  return <section className="quest-input-check" aria-label="クエストの入力チェック"><h2>入力チェック</h2><p><strong>確認状況：{progress.reviewed} / {progress.total}項目（{progress.percent}%）</strong></p><progress value={progress.reviewed} max={progress.total}/>
    <p className="muted">確認状況の割合です。入力内容の正確さを自動判定するものではありません。未完成でも下書き保存できます。該当なしと未確認は別に記録します。</p>
    <div className="quest-review-grid">{(Object.keys(QUEST_REVIEW_LABELS) as QuestReviewKey[]).map(key => <SelectField key={key} label={QUEST_REVIEW_LABELS[key] + "の確認状態"} value={quest.review[key]} options={QUEST_REVIEW_STATES} onChange={(state: QuestReviewState) => onChange({ ...quest, review: { ...quest.review, [key]: state } })}/>)}</div>
    <details open={issues.some(i => i.severity === "error")}><summary>公開前の確認事項：{issues.length}件</summary>{issues.length ? <ul>{issues.map((issue, i) => <li key={i}><strong>{issue.severity === "error" ? "要確認" : "任意項目・未確認"}</strong>：{issue.message} <button type="button" onClick={() => onFocus(issue.key === "notes" ? "notes" : reviewSection[issue.key])}>入力箇所へ</button></li>)}</ul> : <p>必須項目の不足はありません。プレビューで内容・情報源を確認してください。</p>}</details>
    <small>公開には、{[...QUEST_REVIEW_REQUIRED].map(key => QUEST_REVIEW_LABELS[key]).join("・")}の確認が必要です。任意項目は未確認のままでも、その状態を明示します。</small>
  </section>;
}
export function QuestArticleFields({ quest: q, onChange, characters, articles, secret, onError, onUploading, focus, onFocusBody, onFocusWave }: {
  quest: ArticleQuest; onChange: (quest: ArticleQuest) => void; characters: ArticleCharacterLink[]; articles: Article[]; secret: string; onError: (message: string) => void; onUploading: (busy: boolean) => void;
  focus?: { key: QuestArticleSectionKey; target: "fields" | "body"; waveId?:string; waveTarget?:"points"|"notes"; nonce: number }; onFocusBody: (key: QuestArticleSectionKey) => void; onFocusWave:(id:string,target:"points"|"notes")=>void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [picker, setPicker] = useState<{ choose: (id: string) => void } | null>(null);
  function focusFields(key: QuestArticleSectionKey) { const element = root.current?.querySelector<HTMLDetailsElement>(`[data-quest-fields="${key}"]`); if (element) { element.open = true; element.scrollIntoView({ block: "start" }); element.querySelector<HTMLInputElement | HTMLSelectElement>("input,select,textarea")?.focus({ preventScroll: true }); } }
  useEffect(() => { if (focus?.target === "fields") { const element = root.current?.querySelector<HTMLDetailsElement>(`[data-quest-fields="${focus.key}"]`); if (element) { element.open = true; const destination=focus.waveId?Array.from(element.querySelectorAll<HTMLElement>("[data-quest-wave]")).find(e=>e.dataset.questWave===focus.waveId)??element:element;destination.scrollIntoView({ block: "start" }); destination.querySelector<HTMLInputElement>("input,select,textarea")?.focus({ preventScroll: true }); } } }, [focus]);
  const update = (patch: Partial<ArticleQuest>) => {
    const next={...q,...patch};
    if(next.waves)next.waves=clearMissingQuestEnemyReferences(next.waves,next.enemies).map(w=>({...w,mechanicIds:w.mechanicIds.filter(id=>next.mechanics.some(r=>r.id===id)),boardIds:w.boardIds.filter(id=>next.boards.some(r=>r.id===id)),bombIds:w.bombIds.filter(id=>next.bombs.some(r=>r.id===id)),phaseIds:w.phaseIds.filter(id=>next.phases.some(r=>r.id===id))}));
    onChange(next);
  };
  function addWave() { update({waves:[...(q.waves??[]),{id:id(),name:"WAVE "+((q.waves?.length??0)+1),mechanicIds:[],boardIds:[],bombIds:[],phaseIds:[],hazardsState:"unconfirmed"}]}); }
  function importLegacyWaves() { update({waves:questWaves(q).map(w=>({id:id(),name:w.name,mechanicIds:w.mechanicIds,boardIds:w.boardIds,bombIds:w.bombIds,phaseIds:w.phaseIds,hazardsState:"unconfirmed"}))}); }
  function focusEnemyPlacements(waveId?:string) { const panel=root.current?.querySelector<HTMLDetailsElement>('[data-quest-fields="overview"]');if(panel)panel.open=true;const target=document.getElementById(waveId?"quest-enemy-wave-"+waveId:"quest-enemy-placements");target?.scrollIntoView({block:"start"});target?.querySelector<HTMLElement>("select,button")?.focus({preventScroll:true}); }
  function changeWave(waveId:string,patch:Partial<QuestArticleWave>) { update({waves:q.waves?.map(w=>w.id===waveId?{...w,...patch}:w)}); }
  const addMechanic = (category: QuestArticleMechanic["category"] = "gimmick", name = "") => update({ mechanics: [...q.mechanics, { id: id(), name, category, occurrence: "present", importance: "unknown", counterTrait: "", counterTags: [], durability: "", wave: "", turn: "", note: "" }] });
  function changeMechanics(mechanics: ArticleQuest["mechanics"]) { update({ mechanics, phases: q.phases.map(p => ({ ...p, mechanicIds: p.mechanicIds.filter(key => mechanics.some(m => m.id === key)) })) }); }
  function characterField(characterId: string | null, choose: (id: string | null) => void, label = "キャラを選択") {
    const c = characters.find(c => c.id === characterId);
    return <div className="quest-character-field">{c ? <CharacterArticleCard character={c}/> : <span className="muted">未選択</span>}<div className="quest-row-actions"><button type="button" onClick={() => setPicker({ choose: id => choose(id) })}>{label}</button>{characterId && <button type="button" onClick={() => choose(null)}>選択を解除</button>}</div></div>;
  }
  async function uploadMedia(file: File, choose:(image:ArticleImage)=>void, purpose="icon") {
    onUploading(true); onError("");
    try {
      const form = new FormData(); form.append("image", file); form.append("purpose",purpose);
      const response = await fetch("/api/admin/article-media", { method: "POST", headers: { "x-admin-password": secret }, body: form });
      if (!response.ok) throw new Error(await response.text());
      const { src,width,height } = await response.json() as { src: string;width:number;height:number };
      choose({src,alt:"",width,height,widthPercent:100,align:"center"});
    } catch (e) { onError(e instanceof Error ? e.message : "盤面画像を保存できませんでした。"); }
    finally { onUploading(false); }
  }
  function imageField(label:string,image:ArticleImage|undefined,change:(image:ArticleImage|undefined)=>void) {
    return <div className="quest-wide-field"><label>{label}をアップロード<input type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={e=>{const file=e.target.files?.[0];if(file)void uploadMedia(file,change);e.target.value="";}}/></label><small>利用条件を確認した画像を登録してください。未登録時は文字で表示します。</small>{image?<><ArticleMediaImage image={image}/><ArticleImageWidthFields image={image} onChange={change}/><TextField label={label+"の代替テキスト"} value={image.alt} onChange={alt=>change({...image,alt})}/><TextField label={label+"の説明文"} value={image.caption??""} onChange={caption=>change({...image,caption})}/><button type="button" onClick={()=>change(undefined)}>{label}を外す</button></>:null}</div>;
  }
  function waveField(label:string,value:string,change:(value:string)=>void) {
    return q.waves?.length?<p className="muted">WAVEの割り当ては「WAVE・ターン別攻略」で選択します。{value?"旧表記："+value:""}</p>:<TextField label={label} value={value} onChange={change}/>;
  }
  function panel(key: QuestArticleSectionKey, children: ReactNode) {
    return <details className="quest-field-section" data-quest-fields={key} id={"quest-fields-" + key} open={key === "overview" ? true : undefined}><summary>{QUEST_SECTIONS[key]}の共通項目</summary><div className="quest-field-section-body">{children}<button type="button" onClick={() => onFocusBody(key)}>このセクションの解説をTiptapで編集</button></div></details>;
  }
  return <div ref={root} className="quest-editor-fields">
    <h2>クエスト共通項目</h2><p>共通データはここで管理し、記事へ自動表示します。解説・画像・表・文字装飾は下のTiptap本文で編集できます。</p>
    <QuestInputCheck quest={q} onChange={onChange} onFocus={focusFields}/>
    {panel("overview", <>
      <div className="quest-field-grid"><TextField label="クエスト名" value={q.name} onChange={name => update({ name })}/><TextField label="攻略対象ボス" value={q.boss} onChange={boss => update({ boss })}/>
        <CustomSelectField label="難易度" options={QUEST_DIFFICULTIES} value={q.difficulty} onChange={difficulty => update({ difficulty })}/><TextField label="クエストの分類" value={q.category} onChange={category => update({ category })}/>
        <label>関連イベント記事<select value={q.relatedEventArticleId} onChange={e => update({ relatedEventArticleId: e.target.value })}><option value="">関連付けなし</option>{articles.filter(a => a.type === "event_summary" || a.id === q.relatedEventArticleId).map(a => <option key={a.id} value={a.id}>{a.title}{a.status === "published" ? "" : "（非公開）"}</option>)}</select></label>
        <NumberField label="消費体力（未確認なら空欄）" value={q.stamina} onChange={stamina => update({ stamina })}/><TextField label="参加条件" multiline value={q.participation} onChange={participation => update({ participation })}/>
      </div>
      <div className="quest-field-grid"><div><strong>ボスのキャラ画像・DBリンク</strong><p className="muted">DBから選んだキャラの画像を、記事タイトルの左と基本情報に表示します。画像の保存・アップロードは不要です。アップロード画像がある場合はそちらを優先します。</p>{characterField(q.bossCharacterId??null,characterId=>update({bossCharacterId:characterId??""}),"ボスをDBから選択")}</div>{imageField("ボス画像",q.bossImage,bossImage=>update({bossImage}))}</div>
      <h3>ドロップ報酬</h3><SelectField label="ドロップ報酬の確認状態" value={q.dropsState??"unconfirmed"} options={QUEST_REVIEW_STATES} onChange={dropsState=>update({dropsState})}/>
      <Rows label="ドロップ報酬" rows={q.drops??[]} onChange={drops=>update({drops})} onAdd={()=>update({drops:[...(q.drops??[]),{id:id(),kind:"item",characterId:"",name:"",condition:""}]})}>{(d,patch)=><>
        <SelectField label="報酬の種類" value={d.kind} options={{character:"キャラ",item:"アイテム"}} onChange={kind=>patch({kind})}/>{d.kind==="character"?characterField(d.characterId,characterId=>patch({characterId:characterId??""}),"報酬キャラを選択"):<TextField label="報酬アイテム名" value={d.name} onChange={name=>patch({name})}/>}
        <TextField label="報酬の入手条件・補足" value={d.condition} multiline onChange={condition=>patch({condition})}/>{d.kind==="item"?imageField("報酬画像",d.image,image=>patch({image})):null}
      </>}</Rows>
      <h3>敵の基本情報（全WAVE共通）</h3><p className="muted">ここで敵を登録し、下の「WAVE別の敵数・配置」で登場する敵と位置を選びます。</p>
      <Rows label="敵" rows={q.enemies} onChange={enemies => update({ enemies })} onAdd={() => update({ enemies: [...q.enemies, { id: id(), name: "", role: "boss", attributes: [], species: [], hp: "", note: "" }] })}>{(e, patch) => <>
        <TextField label="敵の名称" value={e.name} onChange={name => patch({ name })}/><SelectField label="敵の役割" value={e.role} options={{ boss: "ボス", mob: "雑魚" }} onChange={role => patch({ role })}/>
        <MultiChoiceField label="敵の属性" options={QUEST_ATTRIBUTE_OPTIONS} value={e.attributes} onChange={attributes => patch({ attributes })}/><MultiChoiceField label="敵の種族" options={QUEST_SPECIES_OPTIONS} value={e.species} onChange={species => patch({ species })}/><TextField label="敵のHP（判明分のみ）" value={e.hp} onChange={hp => patch({ hp })}/><TextField label="敵の補足・難易度差" multiline value={e.note} onChange={note => patch({ note })}/><div className="quest-wide-field"><strong>登場WAVE・配置</strong><p>{q.waves?.flatMap(w=>(w.enemyPlacements??[]).filter(p=>p.enemyId===e.id).map(p=>w.name+"："+questEnemyPositionText(p.position))).join(" ／ ")||"未登録"}</p><button type="button" onClick={()=>focusEnemyPlacements()}>この敵の登場WAVE・配置を設定</button></div>
      </>}</Rows>
      <QuestWaveEnemiesFields quest={q} onChangeWave={changeWave} onAddWave={addWave} onImportLegacy={importLegacyWaves} hasLegacyWaves={!!questWaves(q).length}/>
    </>)}
    {panel("hazards", <>
      <p className="muted">ギミック・状態異常を候補から選んで追加できます。複数ある場合は項目を追加し、それぞれの出現WAVE・ターンや対策を設定してください。</p>
      <label>既存の名称から追加<select value="" onChange={e => { const [category, name] = e.target.value.split("|"); if (name) addMechanic(category as QuestArticleMechanic["category"], name); }}><option value="">選択してください</option><optgroup label="ギミック">{QUEST_GIMMICKS.map(name => <option key={name} value={"gimmick|" + name}>{name}</option>)}</optgroup><optgroup label="状態異常">{QUEST_AILMENTS.map(name => <option key={name} value={"ailment|" + name}>{name}</option>)}</optgroup></select></label>
      <Rows label="ギミック・状態異常" rows={q.mechanics} onChange={changeMechanics} onAdd={() => addMechanic()}>{(m, patch) => <>
        <SelectField label="カテゴリ" value={m.category} options={QUEST_MECHANIC_CATEGORIES} onChange={category => patch({ category })}/><CustomSelectField label="ギミック・状態異常の名称" options={m.category === "gimmick" ? QUEST_GIMMICKS : m.category === "ailment" ? QUEST_AILMENTS : []} value={m.name} onChange={name => patch({ name })}/>
        <SelectField label="出現有無" value={m.occurrence} options={QUEST_OCCURRENCE} onChange={occurrence => patch({ occurrence })}/><SelectField label="対策の重要度" value={m.importance} options={QUEST_IMPORTANCE} onChange={importance => patch({ importance })}/>
        <TextField label="必要な対策特性" value={m.counterTrait} onChange={counterTrait => patch({ counterTrait })}/><NumberField label="出現数" value={m.count} onChange={count => patch({ count })}/><TextField label="耐久値など" value={m.durability} onChange={durability => patch({ durability })}/>{waveField("出現WAVE",m.wave,wave=>patch({wave}))}<TextField label="出現ターン" value={m.turn} onChange={turn => patch({ turn })}/><TextField label="ギミック等の補足" multiline value={m.note} onChange={note => patch({ note })}/>
        <details className="quest-wide-field quest-icon-editor"><summary>表示用アイコン（任意）</summary>{imageField("ギミック・状態異常アイコン",m.icon,icon=>patch({icon}))}</details><details className="quest-wide-field"><summary>キャラDBの対策検索タグと関連付け</summary><p className="muted">通常とスーパーを区別します。対策の一致だけで適正とは判定しません。</p><div className="quest-tag-options">{QUEST_COUNTER_TAGS.map(tag => <label key={tag}><input type="checkbox" checked={m.counterTags.includes(tag)} onChange={e => patch({ counterTags: e.target.checked ? [...m.counterTags, tag] : m.counterTags.filter(t => t !== tag) })}/>{tag}</label>)}</div></details>
      </>}</Rows>
    </>)}
    {panel("boards", <>
      <div className="quest-field-grid"><QuestAxisField quest={q} onChange={axes => update({ axes })}/><TextField label="文字軸の補足" value={q.axisNote} onChange={axisNote => update({ axisNote })}/></div>
      <Rows label="盤面" rows={q.boards} onChange={boards => update({ boards })} onAdd={() => update({ boards: [...q.boards, { id: id(), label: "", pattern: "", wave: "", turn: "", phase: "", words: [], behavior: "" }] })}>{(b, patch) => <>
        <SelectField label="盤面の表示方法" value={b.display??"both"} options={{both:"画像と文字列",image:"画像を優先",pattern:"文字列を優先"}} onChange={display=>patch({display})}/><TextField label="盤面名" value={b.label} onChange={label => patch({ label })}/><TextField label="盤面の文字配列（空きマスは□）" value={b.pattern} onChange={pattern => patch({ pattern })} multiline/>
        {waveField("盤面のWAVE",b.wave,wave=>patch({wave}))}<TextField label="盤面のターン" value={b.turn} onChange={turn => patch({ turn })}/><TextField label="盤面のフェーズ" value={b.phase} onChange={phase => patch({ phase })}/><LinesField label="作れることばの例" value={b.words} onChange={words => patch({ words })}/><TextField label="文字変換・特殊挙動" multiline value={b.behavior} onChange={behavior => patch({ behavior })}/>
        <div className="quest-wide-field"><label>盤面画像をアップロード<input type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={e => { const file = e.target.files?.[0]; if (file) void uploadMedia(file,image=>patch({image}),"screenshot"); e.target.value = ""; }}/></label>{b.image && <><ArticleMediaImage image={b.image}/><ArticleImageWidthFields image={b.image} onChange={(image: ArticleImage) => patch({ image })}/><TextField label="盤面画像の代替テキスト" value={b.image.alt} onChange={alt => patch({ image: { ...b.image!, alt } })}/><TextField label="盤面画像のキャプション" value={b.image.caption ?? ""} onChange={caption => patch({ image: { ...b.image!, caption } })}/><button type="button" onClick={() => patch({ image: undefined })}>盤面画像を外す</button></>}</div>
      </>}</Rows>
    </>)}
    {panel("bombs", <Rows label="ボム・特殊条件" rows={q.bombs} onChange={bombs => update({ bombs })} onAdd={() => update({ bombs: [...q.bombs, { id: id(), kind: "", timing: "", condition: { theme: "", text: "" }, success: "", failure: "", method: "" }] })}>{(b, patch) => <>
      <CustomSelectField label="ボムの種類" options={QUEST_BOMB_KINDS} value={b.kind} onChange={kind => patch({ kind })}/><TextField label="ボムの発生タイミング" value={b.timing} onChange={timing => patch({ timing })}/><NumberField label="解除までのターン数" min={1} value={b.turnLimit} onChange={turnLimit => patch({ turnLimit })}/>
      <NumberField label="解除条件・最小文字数" min={1} value={b.condition.minWordLength} onChange={minWordLength => patch({ condition: { ...b.condition, minWordLength } })}/><NumberField label="解除に必要な回数" min={1} value={b.condition.requiredCount} onChange={requiredCount => patch({ condition: { ...b.condition, requiredCount } })}/><TextField label="解除条件・テーマなど" value={b.condition.theme} onChange={theme => patch({ condition: { ...b.condition, theme } })}/><TextField label="複雑な解除条件・自由記述" multiline value={b.condition.text} onChange={text => patch({ condition: { ...b.condition, text } })}/>
      <TextField label="解除成功時の効果" multiline value={b.success} onChange={success => patch({ success })}/><TextField label="解除失敗時の効果" multiline value={b.failure} onChange={failure => patch({ failure })}/><TextField label="推奨する解除方法" multiline value={b.method} onChange={method => patch({ method })}/>
    </>}</Rows>)}
    {panel("characters", <>
      <p className="muted">キャラはIDで参照します。画像・属性・種族・文字は既存DBを使い、性能を記事側へコピーしません。実際の適正を確認してからチェックを入れてください。</p>
      <Rows label="適正候補" rows={q.recommendations} onChange={recommendations => update({ recommendations })} onAdd={() => update({ recommendations: [...q.recommendations, { id: id(), characterId: "", role: "sub", reason: "", confirmed: false }] })}>{(r, patch) => <>
        {characterField(r.characterId, characterId => patch({ characterId: characterId ?? "", confirmed: false }))}<SelectField label="適正候補の役割" value={r.role} options={{ leader: "リーダー候補", sub: "サブ候補" }} onChange={role => patch({ role })}/><TextField label="適正理由" multiline value={r.reason} onChange={reason => patch({ reason, confirmed: false })}/><label className="quest-inline-check"><input type="checkbox" checked={r.confirmed} onChange={e => patch({ confirmed: e.target.checked })}/>管理者が適正を確認済み</label>
      </>}</Rows>
    </>)}
    {panel("teams", <Rows label="編成例" rows={q.teams} onChange={teams => update({ teams })} onAdd={() => update({ teams: [...q.teams, { id: id(), name: "", slots: Array.from({ length: 12 }, () => null), note: "" }] })}>{(t, patch) => <>
      <TextField label="編成名" value={t.name} onChange={name => patch({ name })}/><TextField label="編成の補足・使い方" multiline value={t.note} onChange={note => patch({ note })}/><div className="quest-team-editor quest-wide-field">{t.slots.map((characterId, index) => <div className="quest-team-slot" key={index}><strong>{index === 0 ? "リーダー・1枠" : `${index + 1}枠`}</strong>{characterField(characterId, value => patch({ slots: t.slots.map((slot, si) => si === index ? value : slot) }), `${index + 1}枠のキャラを選択`)}</div>)}</div>
    </>}</Rows>)}
    {panel("phases", <>
      <h3>WAVE名・表示順・関連情報</h3><p>共通項目から登録済みの情報を選びます。複数のWAVEで同じ情報を使えます。未割り当ての情報は記事の「共通・WAVE未指定」に残ります。</p>
      {!q.waves?.length&&questWaves(q).length?<button type="button" onClick={importLegacyWaves}>既存のWAVE番号を取り込み、個別解説を編集する</button>:null}
      <Rows label="WAVE" rows={q.waves??[]} onChange={waves=>update({waves})} onAdd={addWave}>{(w,patch)=><div className="quest-wide-field quest-wave-fields" data-quest-wave={w.id}>
        <div className="quest-field-grid"><TextField label="WAVE名" value={w.name} onChange={name=>patch({name})}/><SelectField label="このWAVEのギミック・状態異常の確認状態" value={w.hazardsState??"unconfirmed"} options={QUEST_REVIEW_STATES} onChange={hazardsState=>patch({hazardsState})}/></div>
        <div><strong>敵数・配置</strong><p>{w.enemyCount===undefined?"未確認":w.enemyCount+"体"}</p><button type="button" onClick={()=>focusEnemyPlacements(w.id)}>このWAVEの敵数・配置を設定</button></div>
        <ReferenceChoices label="このWAVEのギミック・状態異常" rows={q.mechanics.map(m=>({id:m.id,name:m.name+(m.occurrence==="absent"?"（出現しない）":"")}))} value={w.mechanicIds} onChange={mechanicIds=>patch({mechanicIds})}/>
        <ReferenceChoices label="このWAVEの盤面・敵配置画像" rows={q.boards.map(b=>({id:b.id,name:b.label}))} value={w.boardIds} onChange={boardIds=>patch({boardIds})}/>
        <ReferenceChoices label="このWAVEのボム・特殊条件" rows={q.bombs.map(b=>({id:b.id,name:b.kind+" · "+b.timing}))} value={w.bombIds} onChange={bombIds=>patch({bombIds})}/>
        <ReferenceChoices label="このWAVEの敵行動・フェーズ" rows={q.phases.map(p=>({id:p.id,name:p.name}))} value={w.phaseIds} onChange={phaseIds=>patch({phaseIds})}/>
        <div className="quest-row-actions"><button type="button" onClick={()=>onFocusWave(w.id,"points")}>攻略ポイントをTiptapで編集</button><button type="button" onClick={()=>onFocusWave(w.id,"notes")}>注意点をTiptapで編集</button></div>
      </div>}</Rows><h3>敵の行動・フェーズの共通項目</h3>
      <Rows label="フェーズ" rows={q.phases} onChange={phases => update({ phases })} onAdd={() => update({ phases: [...q.phases, { id: id(), name: "", wave: "", turn: "", trigger: "", actions: "", mechanicIds: [], response: "" }] })}>{(p, patch) => <>
      <TextField label="フェーズ名" value={p.name} onChange={name => patch({ name })}/>{waveField("WAVE",p.wave,wave=>patch({wave}))}<TextField label="ターン" value={p.turn} onChange={turn => patch({ turn })}/><TextField label="HP条件・雑魚撃破などの移行条件" multiline value={p.trigger} onChange={trigger => patch({ trigger })}/><TextField label="敵の行動・バリア・蘇生など" multiline value={p.actions} onChange={actions => patch({ actions })}/><NumberField label="即死までなどのターン制限" min={1} value={p.turnLimit} onChange={turnLimit => patch({ turnLimit })}/><TextField label="対処方法" multiline value={p.response} onChange={response => patch({ response })}/>
      <fieldset className="quest-tag-options quest-wide-field"><legend>発生するギミック等を関連付け</legend>{q.mechanics.map(m => <label key={m.id}><input type="checkbox" checked={p.mechanicIds.includes(m.id)} onChange={e => patch({ mechanicIds: e.target.checked ? [...p.mechanicIds, m.id] : p.mechanicIds.filter(id => id !== m.id) })}/>{m.name || "名称未入力"}</label>)}</fieldset>
    </>}</Rows></>)}
    {panel("notes", <div className="quest-field-grid"><TextField label="最終確認日" type="date" value={q.lastCheckedOn} onChange={lastCheckedOn => update({ lastCheckedOn })}/><LinesField label="公式情報・出典URL" value={q.sources} onChange={sources => update({ sources })}/><p className="muted">記事の更新履歴は保存時に自動記録します。検証メモや補足はこのセクションのTiptap本文に記載できます。</p></div>)}
    <p className="muted">「攻略の重要ポイント」はTiptapで直接編集します。セクションの順序は本文のセクション操作から変更できます。</p>
    {picker && <ArticleCharacterPicker characters={characters} onClose={() => setPicker(null)} onChoose={c => { picker.choose(c.id); setPicker(null); }}/>}
  </div>;
}
