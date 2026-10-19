"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { articleEventStatus, EVENT_KIND_LABELS, EVENT_STATUS_LABELS, eventPeriodStatus, eventPeriodText, isSafeArticleUrl } from "@/lib/articleEvents";
import { activityBodyBlocks, activitySectionId, eventArticleSources, eventArticleToc } from "@/lib/articleEventContent";
import type { Article, QuestArticleSectionKey } from "@/lib/types";
import { QuestArticleContent, QuestArticleOverview, type ArticleRelatedLink } from "./QuestArticleContent";
import { ArticleBodyBlock, RichArticleSections } from "./RichArticleBody";
import { ArticleMediaImage } from "./ArticleMediaImage";

export type ArticleCharacterLink = { id: string; name: string; imageUrl?:string; attribute?:string; attributes?:string[]; race?:string; species?:string; letters?:string[] };
export function ArticleContent({ article, characters = [], relatedArticles = [], initialNow, preview = false, previewLabel, onEditActivity, onEditQuestSection }: { article: Article; characters?: ArticleCharacterLink[]; relatedArticles?:ArticleRelatedLink[]; initialNow?: string; preview?: boolean; previewLabel?:string; onEditActivity?:(id:string)=>void; onEditQuestSection?:(key:QuestArticleSectionKey,target:"fields"|"body",waveId?:string,waveTarget?:"points"|"notes")=>void }) {
  const [now, setNow] = useState(initialNow ?? new Date().toISOString());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date().toISOString()), 30000); return () => window.clearInterval(timer); }, []);
  const event = article.event;
  const names = new Map(characters.map(c => [c.id,c.name]));
  const clock = new Date(now), toc = eventArticleToc(article);
  return <article className={"article-preview event-article"+(event?" event-reading-article":"")}>
    {preview ? <p className="article-draft-notice">{previewLabel??"下書きプレビュー・一般公開されていません"}</p> : null}
    <header>{article.quest?<QuestArticleOverview article={article} characters={characters} relatedArticles={relatedArticles} preview={preview} onEdit={onEditQuestSection}/>:<h1>{article.title}</h1>}
      <p className="article-date">{article.publishedOn?<time dateTime={article.publishedOn}>公開日：{article.publishedOn.replaceAll("-","/")}</time>:article.status==="draft"?<time dateTime={article.createdAt}>下書き作成日：{new Date(article.createdAt).toLocaleDateString("ja-JP",{timeZone:"Asia/Tokyo"})}</time>:"公開日：未登録"}</p>
      {article.summary ? <p className="article-preview-summary">{article.summary}</p> : null}
      {article.coverImage?<ArticleMediaImage image={article.coverImage} zoomable/>:null}
      {event ? <div className="event-article-meta">
        <span className={"event-status event-status-" + articleEventStatus(event,clock)}>{event.period ? "イベント" : "期間限定施策"}：{EVENT_STATUS_LABELS[articleEventStatus(event,clock)]}</span>
        <span>最終確認日：{event.lastCheckedOn || "未確認"}</span><span>日時はすべて日本時間</span>
      </div> : null}
    </header>
    {article.quest ? <QuestArticleContent article={article} characters={characters} relatedArticles={relatedArticles} preview={preview} onEdit={onEditQuestSection}/> : event ? <>
      <RichArticleSections article={{...article,sections:article.sections.slice(0,1),toc:false}} characters={characters}/>
      {event.period?<p className="event-overall-period"><strong>イベント全体の開催期間</strong><br/>{eventPeriodText(event.period)}</p>:null}
      <nav className="event-reading-toc" id="event-article-toc" aria-label="イベント記事の目次"><details open><summary>目次</summary><ol>{toc.map(entry=><li key={entry.id}><a href={"#"+encodeURIComponent(entry.id)}>{entry.label}</a></li>)}</ol></details></nav>
      <div className="event-reading-sections">{event.activities.map(activity=>{
        const blocks=activityBodyBlocks(activity);
        const cardIds=new Set(blocks.filter(b=>b.type==="characterCard").flatMap(b=>b.characterIds??[]));
        return <section key={activity.id} id={activitySectionId(activity.id)} className="event-reading-section">
          <h2>{activity.name}</h2>
          <div className="event-reading-section-meta"><span className="event-kind">{EVENT_KIND_LABELS[activity.kind]}</span><span className={"event-status event-status-"+eventPeriodStatus(activity.period,clock)}>{EVENT_STATUS_LABELS[eventPeriodStatus(activity.period,clock)]}</span>{onEditActivity?<button type="button" className="event-preview-edit" onClick={()=>onEditActivity(activity.id)}>この施策を編集</button>:null}</div>
          {blocks.map(block=><ArticleBodyBlock key={block.id} block={block} characters={characters}/>)}
          {activity.characterIds.some(id=>!cardIds.has(id))?<div className="event-character-links" aria-label={activity.name+"の関連キャラ"}>{activity.characterIds.filter(id=>!cardIds.has(id)).map(id=>names.has(id)?<Link key={id} href={"/characters/"+encodeURIComponent(id)}>{names.get(id)}</Link>:<span key={id} className="muted">キャラ情報を確認できません</span>)}</div>:null}
          <div className="event-reading-period"><h3>実施期間</h3><p>{eventPeriodText(activity.period)}</p></div>
          <a className="event-back-to-toc" href="#event-article-toc">目次へ戻る ↑</a>
        </section>;
      })}</div>
      <RichArticleSections article={{...article,sections:article.sections.slice(1),toc:false}} characters={characters}/>
      <section className="event-reading-sources"><h2>公式情報・出典</h2><ul>{eventArticleSources(article).filter(isSafeArticleUrl).map((url,index)=><li key={url}><a href={url} target="_blank" rel="noopener noreferrer">公式情報 {index+1}</a></li>)}</ul>
        <h3>更新履歴</h3>{event.history.length?<ul>{event.history.map((entry,index)=><li key={index}>{entry.checkedOn}：{entry.note}</li>)}</ul>:<p className="muted">更新履歴は未登録です。</p>}
      </section>
    </>:<RichArticleSections article={article} characters={characters}/>}
    {article.editHistory?.length?<details className="article-edit-history"><summary>記事の編集履歴</summary><ul>{article.editHistory.map((entry,index)=><li key={index}>{new Date(entry.at).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}：{entry.note}</li>)}</ul></details>:null}
  </article>;
}
