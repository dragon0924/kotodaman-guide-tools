"use client";
import { instantToJstInput, jstInputToInstant } from "@/lib/articleEvents";
import type { ArticleEventPeriod } from "@/lib/types";
export function EventPeriodFields({period,onChange,label}:{period:ArticleEventPeriod;onChange:(next:ArticleEventPeriod)=>void;label:string}) {
  return <div className="event-period-editor" aria-label={label}>
    <label>開始日時（日本時間）<input type="datetime-local" value={instantToJstInput(period.startAt)} onChange={e=>onChange({...period,startAt:jstInputToInstant(e.target.value),startDate:undefined})}/></label>
    <label>終了日時（日本時間）<input type="datetime-local" value={instantToJstInput(period.endAt)} onChange={e=>onChange({...period,endAt:jstInputToInstant(e.target.value)})}/></label>
    <label>開始日だけ判明している場合<input type="date" value={period.startDate??""} disabled={!!period.startAt} onChange={e=>onChange({...period,startDate:e.target.value||undefined})}/></label>
    <label>開始の補足<input value={period.startNote??""} placeholder="頃／メンテナンス後（時刻未公表）" onChange={e=>onChange({...period,startNote:e.target.value})}/></label>
    <label>終了の補足<input value={period.endNote??""} onChange={e=>onChange({...period,endNote:e.target.value})}/></label>
    <label>開催の区分<select value={period.availability??"limited"} onChange={e=>onChange({...period,availability:e.target.value as ArticleEventPeriod["availability"]})}><option value="limited">期間限定</option><option value="permanent">常設</option><option value="schedule">出現スケジュールに従う</option></select></label>
  </div>;
}
