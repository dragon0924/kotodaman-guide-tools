"use client";
import { useId, useState, type ReactNode } from "react";
import type { Article, ArticleQuest, ArticleSection, QuestArticleSectionKey } from "@/lib/types";
import { QUEST_IMPORTANCE, QUEST_MECHANIC_CATEGORIES, QUEST_OCCURRENCE, QUEST_REVIEW_STATES, questAxisText, questHasAxis, questCountermeasureGroups, questBlocksHaveContent, questBombCondition, questSectionAnchor, visibleQuestSections } from "@/lib/questArticle";
import { questUnassignedData, questWaveBody, questWaveData, questWaves } from "@/lib/questArticleLayout";
import { QuestBossPortrait, QuestWaveEnemyLayout, QuestDropRewards, QuestMechanicTags, QuestRecommendations } from "./QuestGuideParts";
import type { ArticleCharacterLink } from "./ArticleContent";
import { ArticleBodyBlock, CharacterArticleCard } from "./RichArticleBody";
import { ArticleMediaImage } from "./ArticleMediaImage";
import { isSafeArticleUrl } from "@/lib/articleEvents";
import { questEnemyPositionText } from "@/lib/questEnemyLayout";

export type ArticleRelatedLink = { id: string; title: string; href: string };
function Detail({ label, children }: { label: string; children: ReactNode }) {
  return children !== undefined && children !== null && children !== "" ? <div><dt>{label}</dt><dd>{children}</dd></div> : null;
}
export function QuestSectionData({ quest: q, sectionKey, characters, relatedArticles = [], preview = false }: { quest: ArticleQuest; sectionKey: QuestArticleSectionKey; characters: ArticleCharacterLink[]; relatedArticles?: ArticleRelatedLink[]; preview?: boolean }) {
  const character = (id: string) => characters.find(c => c.id === id);
  const related = relatedArticles.find(a => a.id === q.relatedEventArticleId);
  switch (sectionKey) {
    case "overview": return <>
      <dl className="quest-article-facts">
        <Detail label="クエスト名">{q.name}</Detail><Detail label="攻略対象ボス">{q.boss}</Detail><Detail label="難易度">{q.difficulty}</Detail><Detail label="分類">{q.category}</Detail>
        <Detail label="消費体力">{q.stamina}</Detail><Detail label="参加条件">{q.participation}</Detail>
        <Detail label="関連イベント">{related ? <a href={related.href}>{related.title}</a> : q.relatedEventArticleId ? "関連イベント記事は未公開です" : undefined}</Detail>
      </dl>
      {q.enemies.length ? <div className="article-table-scroll"><table><caption>敵の情報</caption><thead><tr><th>敵・役割</th><th>属性・種族</th><th>HP・補足</th><th>WAVE・配置</th></tr></thead><tbody>{q.enemies.map(e => <tr key={e.id}><td>{e.name || "名称未確認"}<small>{e.role === "boss" ? "ボス" : "雑魚"}</small></td><td>{e.attributes.join("・") || "属性未確認"}<br/>{e.species.join("・") || "種族未確認"}</td><td>{e.hp && <p>HP：{e.hp}</p>}{e.note}</td><td>{q.waves?.flatMap(w=>(w.enemyPlacements??[]).filter(p=>p.enemyId===e.id).map(p=>w.name+"："+questEnemyPositionText(p.position))).join(" ／ ")||"配置未登録"}</td></tr>)}</tbody></table></div> : null}
    </>;
    case "hazards": return <>
      <p className="quest-check-summary">ギミック等：{QUEST_REVIEW_STATES[q.review.gimmicks]} ／ 状態異常：{QUEST_REVIEW_STATES[q.review.ailments]}</p>
      {questCountermeasureGroups(q.mechanics).map(group => <div className="article-table-scroll quest-countermeasure-table" key={group.key}><table><caption>{group.label}</caption><thead><tr><th>種類・名称</th><th>出現・重要度</th><th>対策・出現情報</th></tr></thead><tbody>{group.rows.map(m => <tr key={m.id}><td><small>{QUEST_MECHANIC_CATEGORIES[m.category]}</small><strong>{m.name || "名称未確認"}</strong></td><td>{QUEST_OCCURRENCE[m.occurrence]}<br/>{m.occurrence === "present" ? QUEST_IMPORTANCE[m.importance] : ""}</td><td>{m.counterTrait && <p>対策特性：{m.counterTrait}</p>}{m.counterTags.length > 0 && <p>対策検索タグ：{m.counterTags.join("・")}</p>}{m.count !== undefined && <p>出現数：{m.count}</p>}{m.durability && <p>耐久：{m.durability}</p>}{(m.wave || m.turn) && <p>{[!q.waves?.length && m.wave && "WAVE " + m.wave, m.turn && "ターン " + m.turn].filter(Boolean).join(" ／ ")}</p>}{m.note}</td></tr>)}</tbody></table></div>)}
    </>;
    case "boards": return <>
      {(questHasAxis(q) || q.axisNote) && <p><strong>文字軸：{questAxisText(q)}</strong> {q.axisNote}</p>}
      {q.boards.map(b => <div key={b.id} className="quest-reading-entry"><h3>{b.label || "盤面名未入力"}</h3>{(b.wave || b.turn || b.phase) && <p className="muted">{[!q.waves?.length && b.wave && "WAVE " + b.wave, b.turn && "ターン " + b.turn, b.phase].filter(Boolean).join(" ／ ")}</p>}{b.pattern && (b.display!=="image"||!b.image) && <pre className="quest-board-pattern" aria-label="盤面の文字配列">{b.pattern}</pre>}{b.image && (b.display!=="pattern"||!b.pattern) && <ArticleMediaImage image={b.image} zoomable/>}{b.words.length > 0 && <p>ことばの例：{b.words.join(" ／ ")}</p>}{b.behavior && <p className="quest-preserve-lines">{b.behavior}</p>}</div>)}
    </>;
    case "bombs": return <>{q.bombs.map(b => <div key={b.id} className="quest-reading-entry"><h3>{b.kind || "特殊条件名未入力"}</h3><dl className="quest-article-facts"><Detail label="発生タイミング">{b.timing}</Detail><Detail label="解除条件">{questBombCondition(b)}</Detail><Detail label="解除成功時">{b.success}</Detail><Detail label="解除失敗時">{b.failure}</Detail><Detail label="推奨する解除方法">{b.method}</Detail></dl></div>)}</>;
    case "characters": return <>{(["leader", "sub"] as const).map(role => {
      const rows = q.recommendations.filter(r => r.role === role && (preview || r.confirmed));
      return rows.length ? <div key={role}><h3>{role === "leader" ? "リーダー候補" : "サブ候補"}</h3><div className="quest-recommendations">{rows.map(r => <div key={r.id}>{character(r.characterId) ? <CharacterArticleCard character={character(r.characterId)!}/> : <p>キャラ未選択</p>}{!r.confirmed && <strong className="quest-unconfirmed">適正未確認・管理者用の候補</strong>}<p className="quest-preserve-lines">{r.reason}</p></div>)}</div></div> : null;
    })}</>;
    case "teams": return <>{q.teams.map(t => <div key={t.id} className="quest-reading-entry"><h3>{t.name || "編成名未入力"}</h3><ol className="quest-team-grid">{t.slots.map((id, index) => <li key={index}><strong>{index === 0 ? "リーダー・1枠" : `${index + 1}枠`}</strong>{id && character(id) ? <CharacterArticleCard character={character(id)!}/> : <span className="muted">未設定</span>}</li>)}</ol>{t.note && <p className="quest-preserve-lines">{t.note}</p>}</div>)}</>;
    case "phases": return <>{q.phases.map(p => <div key={p.id} className="quest-reading-entry"><h3>{p.name || "フェーズ名未入力"}</h3><dl className="quest-article-facts"><Detail label="WAVE・ターン">{[!q.waves?.length && p.wave && "WAVE " + p.wave, p.turn && "ターン " + p.turn].filter(Boolean).join(" ／ ")}</Detail><Detail label="移行条件">{p.trigger}</Detail><Detail label="敵の行動">{p.actions}</Detail><Detail label="関連ギミック等">{p.mechanicIds.map(id => q.mechanics.find(m => m.id === id)?.name).filter(Boolean).join("・")}</Detail><Detail label="ターン制限">{p.turnLimit}</Detail><Detail label="対処方法">{p.response}</Detail></dl></div>)}</>;
    case "notes": return <>{q.lastCheckedOn && <p>最終確認日：<time dateTime={q.lastCheckedOn}>{q.lastCheckedOn}</time></p>}{q.sources.some(isSafeArticleUrl) && <><h3>公式情報・出典</h3><ul>{q.sources.filter(isSafeArticleUrl).map((url, i) => <li key={i}><a href={url} target="_blank" rel="noopener noreferrer">情報源 {i + 1}</a></li>)}</ul></>}</>;
    default: return null;
  }
}
function QuestFreeBody({section,characters}:{section?:ArticleSection;characters:ArticleCharacterLink[]}) {
  return section&&questBlocksHaveContent(section.blocks)?<>{section.blocks.map(b=><ArticleBodyBlock key={b.id} block={b} characters={characters}/>)}</>:null;
}
export function QuestArticleOverview({article,characters,relatedArticles=[],preview=false,onEdit}:{article:Article;characters:ArticleCharacterLink[];relatedArticles?:ArticleRelatedLink[];preview?:boolean;onEdit?:(key:QuestArticleSectionKey,target:"fields"|"body")=>void}) {
  const q=article.quest!,attributes=[...new Set(q.enemies.flatMap(e=>e.attributes).filter(Boolean))];
  return <section className="quest-guide-summary quest-article-overview" id="quest-overview" aria-label="クエスト基本情報">
      <div className="quest-guide-hero"><QuestBossPortrait quest={q} characters={characters}/><div><h1>{article.title}</h1>{!q.difficulty||!article.title.normalize("NFKC").includes(q.difficulty.trim().normalize("NFKC"))?<p className="quest-guide-difficulty">{q.difficulty||"難易度未確認"}</p>:null}{q.boss&&!article.title.includes(q.boss)?<p>攻略対象：{q.boss}</p>:null}<dl className="quest-guide-quick-facts"><div><dt>敵の属性</dt><dd>{attributes.length?attributes.map(a=><span className="quest-attribute-tag" key={a}>{a}</span>):"未確認"}</dd></div><div><dt>文字軸</dt><dd>{questAxisText(q)}{q.axisNote?" · "+q.axisNote:""}</dd></div></dl></div></div>
      <div className="quest-guide-hazards"><div><h3>状態異常</h3><QuestMechanicTags mechanics={q.mechanics.filter(m=>m.category==="ailment")} state={q.review.ailments}/></div><div><h3>ギミック</h3><QuestMechanicTags mechanics={q.mechanics.filter(m=>m.category!=="ailment")} state={q.review.gimmicks}/></div></div>
      {onEdit?<div className="quest-preview-edit"><button type="button" onClick={()=>onEdit("overview","fields")}>共通項目を編集</button><button type="button" onClick={()=>onEdit("overview","body")}>解説を編集</button></div>:null}<details className="quest-overview-details"><summary>敵・参加条件などの詳細</summary><QuestSectionData quest={q} sectionKey="overview" characters={characters} relatedArticles={relatedArticles} preview={preview}/></details><QuestFreeBody section={article.sections.find(s=>s.questSection==="overview")} characters={characters}/>
    </section>;
}
export function QuestArticleContent({ article, characters, relatedArticles = [], preview = false, onEdit }: { article: Article; characters: ArticleCharacterLink[]; relatedArticles?: ArticleRelatedLink[]; preview?: boolean; onEdit?: (key: QuestArticleSectionKey, target: "fields" | "body", waveId?:string, waveTarget?:"points"|"notes") => void }) {
  const q=article.quest!,waves=questWaves(q),[activeWave,setActiveWave]=useState("");
  const tabId=useId(),active=waves.some(w=>w.id===activeWave)?activeWave:waves[0]?.id;
  const section=(key:QuestArticleSectionKey)=>article.sections.find(s=>s.questSection===key);
  const remaining={...questUnassignedData(q,waves),axis:"unknown" as const,axes:[],axisNote:""};
  const extras=visibleQuestSections({...article,quest:remaining},preview).filter(s=>!s.questWave&&s.questSection!=="overview"&&s.questSection!=="characters");
  const points=extras.find(s=>s.questSection==="points"),otherExtras=extras.filter(s=>s!==points);
  const recs=q.recommendations.some(r=>preview||r.confirmed);
  const anchor=(s:ArticleSection)=>s.questSection?questSectionAnchor(s.questSection):"section-"+s.id;
  const editButtons=(key:QuestArticleSectionKey,waveId?:string,target?:"points"|"notes")=>onEdit?<div className="quest-preview-edit"><button type="button" onClick={()=>onEdit(key,"fields",waveId)}>共通項目を編集</button><button type="button" onClick={()=>onEdit(key,"body",waveId,target)}>解説を編集</button></div>:null;
  const renderExtra=(s:ArticleSection)=><section className="event-reading-section quest-reading-section" id={anchor(s)} key={s.id}><h2>{s.heading}{waves.length&&s.questSection&&["hazards","boards","bombs","phases"].includes(s.questSection)?<small> 共通・WAVE未指定の情報／補足</small>:null}</h2>{s.questSection?editButtons(s.questSection):null}{s.questSection?<QuestSectionData quest={remaining} sectionKey={s.questSection} characters={characters} relatedArticles={relatedArticles} preview={preview}/>:null}<QuestFreeBody section={s} characters={characters}/><a className="event-back-to-toc" href="#quest-article-toc">目次へ戻る ↑</a></section>;
  return <div className="quest-guide-layout">

    <section className="quest-guide-drops" id="quest-drops"><h2>ドロップ報酬</h2><QuestDropRewards quest={q} characters={characters}/>{onEdit?<button type="button" onClick={()=>onEdit("overview","fields")}>報酬を編集</button>:null}</section>
    <nav className="event-reading-toc" id="quest-article-toc" aria-label="クエスト攻略記事の目次"><details open><summary>目次</summary><ol><li><a href="#quest-overview">クエスト基本情報</a></li><li><a href="#quest-drops">ドロップ報酬</a></li>{recs||questBlocksHaveContent(section("characters")?.blocks??[])?<li><a href="#quest-characters">{section("characters")?.heading}</a></li>:null}{points?<li><a href={"#"+anchor(points)}>{points.heading}</a></li>:null}{waves.length?<li><a href="#quest-wave-guide">WAVE別攻略</a></li>:null}{otherExtras.map(s=><li key={s.id}><a href={"#"+anchor(s)}>{s.heading}</a></li>)}</ol></details></nav>
    {recs||questBlocksHaveContent(section("characters")?.blocks??[])?<section className="event-reading-section quest-reading-section" id="quest-characters"><h2>{section("characters")?.heading||"適正キャラクター"}</h2>{editButtons("characters")}<QuestRecommendations quest={q} characters={characters} preview={preview}/><QuestFreeBody section={section("characters")} characters={characters}/></section>:null}
    {points?renderExtra(points):null}
    {waves.length?<section id="quest-wave-guide" className="event-reading-section quest-reading-section"><h2>WAVE別攻略</h2>{onEdit?<button type="button" onClick={()=>onEdit("phases","fields")}>WAVE名・順序・関連情報を編集</button>:null}
      {waves.length>1?<div className="quest-wave-tabs" role="tablist" aria-label="攻略WAVE">{waves.map((w,i)=><button key={w.id} type="button" role="tab" id={tabId+"-tab-"+i} aria-selected={active===w.id} aria-controls={tabId+"-panel-"+i} tabIndex={active===w.id?0:-1} onClick={()=>setActiveWave(w.id)} onKeyDown={e=>{const next=e.key==="ArrowRight"?(i+1)%waves.length:e.key==="ArrowLeft"?(i+waves.length-1)%waves.length:e.key==="Home"?0:e.key==="End"?waves.length-1:-1;if(next>=0){e.preventDefault();setActiveWave(waves[next].id);e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();}}}>{w.name}</button>)}</div>:null}
      {waves.map((w,i)=>{const data=questWaveData(q,w),body=questWaveBody(article,w.id,"points"),notes=questWaveBody(article,w.id,"notes");return <div className="quest-wave-panel" key={w.id} id={tabId+"-panel-"+i} role={waves.length>1?"tabpanel":undefined} aria-labelledby={waves.length>1?tabId+"-tab-"+i:undefined} hidden={waves.length>1&&active!==w.id} tabIndex={0}>
        {waves.length===1||active===w.id?<><h3 className="quest-wave-title">{w.name}</h3><QuestWaveEnemyLayout wave={w} enemies={q.enemies}/>{waves.length>1?<div className="quest-wave-hazards"><h4>このWAVEのギミック・状態異常</h4><QuestMechanicTags mechanics={data.mechanics} state={w.hazardsState}/>{data.mechanics.length?<details><summary>対策・出現情報の詳細</summary><QuestSectionData quest={data} sectionKey="hazards" characters={characters}/></details>:null}</div>:null}
        {waves.length===1&&data.mechanics.length?<details><summary>ギミック・対策の詳細</summary><QuestSectionData quest={data} sectionKey="hazards" characters={characters}/></details>:null}
        {data.boards.length?<div className="quest-wave-boards"><h4>敵の配置・盤面</h4><QuestSectionData quest={{...data,axis:"unknown",axes:[],axisNote:""}} sectionKey="boards" characters={characters}/></div>:null}
        {body&&questBlocksHaveContent(body.blocks)||onEdit&&!w.derived?<div className="quest-wave-points"><h4>攻略ポイント</h4>{onEdit&&!w.derived?<button type="button" onClick={()=>onEdit("phases","body",w.id,"points")}>このWAVEの攻略ポイントを編集</button>:null}<QuestFreeBody section={body} characters={characters}/></div>:null}
        {data.bombs.length||data.phases.length||notes&&questBlocksHaveContent(notes.blocks)||onEdit&&!w.derived?<div className="quest-wave-notes"><h4>注意点・特殊条件</h4>{onEdit&&!w.derived?<button type="button" onClick={()=>onEdit("phases","body",w.id,"notes")}>このWAVEの注意点を編集</button>:null}<QuestFreeBody section={notes} characters={characters}/>{data.bombs.length?<QuestSectionData quest={data} sectionKey="bombs" characters={characters}/>:null}{data.phases.length?<QuestSectionData quest={data} sectionKey="phases" characters={characters}/>:null}</div>:null}
        {onEdit?<button type="button" onClick={()=>onEdit("phases","fields",w.derived?undefined:w.id)}>このWAVEの共通項目を編集</button>:null}</>:null}
      </div>;})}<a className="event-back-to-toc" href="#quest-article-toc">目次へ戻る ↑</a>
    </section>:null}
    {otherExtras.map(renderExtra)}
  </div>;
}
