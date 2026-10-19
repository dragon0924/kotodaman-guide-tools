"use client";
import { useState } from "react";
import { EVENT_KIND_LABELS } from "@/lib/articleEvents";
import type { ArticleEvent, ArticleEventActivity, ArticleEventPeriod } from "@/lib/types";
import type { ArticleCharacterLink } from "@/components/ArticleContent";
import { EventPeriodFields } from "./EventPeriodFields";
export const emptyArticleEvent = (): ArticleEvent => ({name:"",activities:[],officialUrls:[],lastCheckedOn:"",publicationReviewed:false,history:[]});

export function ArticleEventFields({event,onChange,characters,onEditActivity}:{event:ArticleEvent;onChange:(event:ArticleEvent)=>void;characters:ArticleCharacterLink[];onEditActivity?:(id:string)=>void}) {
  const [query,setQuery]=useState("");
  const options=characters.filter(c=>c.name.includes(query.trim())).slice(0,40);
  const patch=(value:Partial<ArticleEvent>)=>onChange({...event,...value,publicationReviewed:false});
  const update=(index:number,value:Partial<ArticleEventActivity>)=>patch({activities:event.activities.map((a,i)=>i===index?{...a,...value}:a)});
  const periodFields=(period:ArticleEventPeriod,change:(next:ArticleEventPeriod)=>void,label:string)=><EventPeriodFields period={period} onChange={change} label={label}/>;
  return <fieldset className="event-article-editor"><legend>イベント情報</legend>
    <div className="event-period-editor"><label>イベント名<input value={event.name} onChange={e=>patch({name:e.target.value})}/></label>
      <label>最終確認日<input type="date" value={event.lastCheckedOn} onChange={e=>patch({lastCheckedOn:e.target.value})}/></label>
      <label className="wide">公式情報URL（1行に1件）<textarea rows={3} value={event.officialUrls.join("\n")} onChange={e=>patch({officialUrls:e.target.value.split(/\r?\n/u).filter(Boolean)})}/></label>
    </div>
    <label className="event-check-label"><input type="checkbox" checked={!!event.period} onChange={e=>patch({period:e.target.checked?{}:undefined})}/>イベント全体の開催期間が公式に明記されている</label>
    {event.period?periodFields(event.period,period=>patch({period}),"イベント全体の期間"):<p className="muted">全体期間は補完せず、各施策の期間を使って開催状況を表示します。</p>}
    <label>関連キャラの候補を絞る<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="キャラ名で探す"/></label>
    {event.activities.map((activity,index)=><section className="event-activity-card" key={activity.id}>
      <div className="event-period-editor"><label>施策名<input value={activity.name} onChange={e=>update(index,{name:e.target.value})}/></label>
        <label>施策の種類<select value={activity.kind} onChange={e=>update(index,{kind:e.target.value as ArticleEventActivity["kind"]})}>{Object.entries(EVENT_KIND_LABELS).map(([kind,label])=><option value={kind} key={kind}>{label}</option>)}</select></label>
      </div>
      {periodFields(activity.period,period=>update(index,{period}),activity.name+"の期間")}
      {onEditActivity?<button type="button" onClick={()=>onEditActivity(activity.id)}>この施策の本文を編集</button>:<p className="muted">施策の本文は中央のビジュアルエディターで編集できます。</p>}
      <label>施策の公式情報URL<input type="url" value={activity.officialUrl} onChange={e=>update(index,{officialUrl:e.target.value})}/></label>
      <label>関連キャラを追加<select value="" onChange={e=>{if(e.target.value)update(index,{characterIds:[...new Set([...activity.characterIds,e.target.value])]});}}><option value="">名前から選択してください</option>{options.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <div className="event-character-links">{activity.characterIds.map(id=><button type="button" key={id} onClick={()=>update(index,{characterIds:activity.characterIds.filter(value=>value!==id)})}>{characters.find(c=>c.id===id)?.name??"未登録キャラ"} ×</button>)}</div>
      <button type="button" className="danger-subtle" onClick={()=>patch({activities:event.activities.filter((_,i)=>i!==index)})}>この施策を削除</button>
    </section>)}
    <button type="button" onClick={()=>patch({activities:[...event.activities,{id:"activity-"+crypto.randomUUID(),name:"新しい施策",kind:"campaign",period:{availability:"limited"},summary:"",characterIds:[],officialUrl:event.officialUrls[0]??""}]})}>ガチャ・報酬・クエストなどを追加</button>
    <div className="event-history-editor">{event.history.map((entry,index)=><div className="event-period-editor" key={index}><label>確認日<input type="date" value={entry.checkedOn} onChange={e=>patch({history:event.history.map((h,i)=>i===index?{...h,checkedOn:e.target.value}:h)})}/></label><label>更新内容<input value={entry.note} onChange={e=>patch({history:event.history.map((h,i)=>i===index?{...h,note:e.target.value}:h)})}/></label></div>)}
      <button type="button" onClick={()=>patch({history:[...event.history,{checkedOn:event.lastCheckedOn,note:""}]})}>更新履歴を追加</button>
    </div>
    <label className="event-check-label"><input type="checkbox" checked={event.publicationReviewed} onChange={e=>onChange({...event,publicationReviewed:e.target.checked})}/>本文・開催期間・関連キャラリンクの公開前確認を完了した</label>
    <p className="muted">終了表示は日時から自動で切り替わります。公開状態は自動で変更されません。本文を編集したら公開前確認をやり直してください。</p>
  </fieldset>;
}
