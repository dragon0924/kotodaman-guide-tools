"use client";
import { useState } from "react";
import type { ArticleQuest, QuestArticleMechanic, QuestArticleWave, QuestReviewState } from "@/lib/types";
import { QUEST_ENEMY_POSITIONS, questWaveEnemyLayout } from "@/lib/questEnemyLayout";
import type { ArticleCharacterLink } from "./ArticleContent";
import { ArticleMediaImage } from "./ArticleMediaImage";
import { CharacterArticleCard } from "./RichArticleBody";

export function QuestMechanicTags({ mechanics, state }: { mechanics: QuestArticleMechanic[]; state?: QuestReviewState }) {
  const visible=mechanics.filter(m=>m.occurrence!=="absent");
  return <div className="quest-mechanic-tags">{visible.map(m=><div className="quest-mechanic-tag" key={m.id}>{m.icon?<ArticleMediaImage image={m.icon} fallback={null}/>:null}<span>{m.name||"名称未確認"}{m.occurrence==="unknown"?"（出現未確認）":""}</span></div>)}{!visible.length?<span className="muted">{state==="none"?"該当なし":state==="confirmed"?"出現情報の登録なし":"未確認"}</span>:state==="unconfirmed"?<small>調査未完了</small>:null}</div>;
}
export function QuestBossImage({character}:{character:ArticleCharacterLink}) {
  const [failed,setFailed]=useState(false);
  return <a className="quest-boss-image" href={"/characters/"+encodeURIComponent(character.id)}>{character.imageUrl&&!failed?<img src={character.imageUrl} alt={character.name} onError={()=>setFailed(true)}/>:<span>{character.name}</span>}</a>;
}
export function QuestBossPortrait({quest,characters}:{quest:ArticleQuest;characters:ArticleCharacterLink[]}) {
  const boss=characters.find(c=>c.id===quest.bossCharacterId);
  if(quest.bossImage)return <div className="quest-boss-image"><ArticleMediaImage image={quest.bossImage}/></div>;
  return boss?<QuestBossImage key={boss.id+":"+boss.imageUrl} character={boss}/>:null;
}
export function QuestWaveEnemyLayout({wave,enemies}:{wave:QuestArticleWave;enemies:ArticleQuest["enemies"]}) {
  const layout=questWaveEnemyLayout(wave,enemies);
  if(!layout)return null;
  return <section className="quest-wave-enemies" aria-label={wave.name+"の敵配置"}><h4>敵の配置{layout.count===undefined?"（敵数未確認）":"（"+layout.count+"体）"}</h4>
    <div className="quest-enemy-layout">{layout.positions.map(slot=><div className="quest-enemy-position" key={slot.position}><strong className="quest-enemy-position-label">{QUEST_ENEMY_POSITIONS[slot.position]}</strong>{slot.placement?<><strong>{slot.placement.enemy?.name||"敵未選択"}</strong>{slot.placement.enemy?<><small>{slot.placement.enemy.role==="boss"?"ボス":"雑魚"}</small><span>{slot.placement.enemy.attributes.join("・")||"属性未確認"}</span><small>{slot.placement.enemy.species.join("・")||"種族未確認"}</small>{slot.placement.enemy.hp||slot.placement.enemy.note?<details><summary>詳細</summary>{slot.placement.enemy.hp?<p>HP：{slot.placement.enemy.hp}</p>:null}{slot.placement.enemy.note?<p className="quest-preserve-lines">{slot.placement.enemy.note}</p>:null}</details>:null}</>:null}</>:<span className="muted">{layout.complete?"登場なし":"未確認"}</span>}</div>)}</div>
    {!layout.complete?<p className="quest-unconfirmed">敵の選択・配置は確認途中です。</p>:null}{layout.unplaced.length?<p>配置未確認：{layout.unplaced.map(p=>p.enemy?.name||"敵未選択").join(" ／ ")}</p>:null}
  </section>;
}
export function QuestRecommendations({quest:q,characters,preview=false}:{quest:ArticleQuest;characters:ArticleCharacterLink[];preview?:boolean}) {
  return <>{(["leader","sub"] as const).map(role=>{
    const rows=q.recommendations.filter(r=>r.role===role&&(preview||r.confirmed));
    return rows.length?<div className="quest-fit-group" key={role}><h3>{role==="leader"?"適正リーダー":"適正サブ"}</h3>{rows.map(r=>{
      const c=characters.find(c=>c.id===r.characterId);
      return <div className="quest-fit-row" key={r.id}>{c?<CharacterArticleCard character={c}/>:<span>キャラ未選択</span>}<div><strong className="quest-fit-reason-label">適正理由</strong>{!r.confirmed?<strong className="quest-unconfirmed">適正未確認・管理者用の候補</strong>:null}<p className="quest-preserve-lines">{r.reason||"理由未入力"}</p></div></div>;
    })}</div>:null;
  })}</>;
}
export function QuestDropRewards({quest:q,characters}:{quest:ArticleQuest;characters:ArticleCharacterLink[]}) {
  return <>{q.drops?.length?<div className="quest-drop-grid">{q.drops.map(d=>{
    const c=d.kind==="character"?characters.find(c=>c.id===d.characterId):undefined;
    return <div className="quest-drop-entry" key={d.id}>{c?<CharacterArticleCard character={c}/>:<>{d.image?<ArticleMediaImage image={d.image}/>:null}<strong>{d.name||(d.kind==="character"?"報酬キャラ未選択":"アイテム名未確認")}</strong></>}{d.condition?<p className="quest-preserve-lines">{d.condition}</p>:null}</div>;
  })}</div>:<p className="muted">{q.dropsState==="none"?"該当なし":q.dropsState==="confirmed"?"報酬の登録なし":"ドロップ報酬は未確認です。"}</p>}</>;
}
