"use client";
import { useState } from "react";
import type { ArticleQuest, QuestArticleWave, QuestWaveEnemyPlacement } from "@/lib/types";
import { QUEST_ENEMY_POSITIONS, planQuestEnemyCount, questEnemyPositionText } from "@/lib/questEnemyLayout";

function WaveEnemyFields({wave,enemies,onChange}:{wave:QuestArticleWave;enemies:ArticleQuest["enemies"];onChange:(patch:Partial<QuestArticleWave>)=>void}) {
  const [reduction,setReduction]=useState<1|2|3>();
  const placements=wave.enemyPlacements??[],pending=reduction===undefined?undefined:planQuestEnemyCount(wave,reduction);
  function changeCount(count:QuestArticleWave["enemyCount"]) {
    const plan=planQuestEnemyCount(wave,count);
    if(count!==undefined&&plan.removed.length){setReduction(count);return;}
    setReduction(undefined);onChange(plan.patch);
  }
  function patchPlacement(index:number,patch:Partial<QuestWaveEnemyPlacement>) {onChange({enemyPlacements:placements.map((p,i)=>i===index?{...p,...patch}:p)});}
  return <>
    <label>敵の数<select value={wave.enemyCount??""} onChange={e=>changeCount(e.target.value?Number(e.target.value) as 1|2|3:undefined)}><option value="">未確認</option>{[1,2,3].map(count=><option value={count} key={count}>{count}体</option>)}</select></label>
    {pending?<div className="quest-enemy-reduction" role="alert"><p>{reduction}体へ変更すると、次の配置枠が外れます。敵の基本情報は残ります。</p><ul>{pending.removed.map((p,i)=><li key={i}>{enemies.find(e=>e.id===p.enemyId)?.name||"敵未選択"} · {questEnemyPositionText(p.position)}</li>)}</ul><button type="button" onClick={()=>{onChange(pending.patch);setReduction(undefined);}}>配置枠を外して{reduction}体に変更</button><button type="button" onClick={()=>setReduction(undefined)}>変更をやめる</button></div>:null}
    {!enemies.length?<p className="muted">上の「敵を追加」で敵の基本情報を登録してから選択してください。</p>:null}
    <div className="quest-enemy-placement-fields">{placements.map((p,index)=><fieldset key={index} className="quest-enemy-slot-field"><legend>登場する敵 {index+1}</legend><label>敵を選択<select value={p.enemyId} onChange={e=>patchPlacement(index,{enemyId:e.target.value})}><option value="">未選択</option>{enemies.map((enemy,i)=><option value={enemy.id} key={enemy.id}>{enemy.name||"名称未入力"} · {enemy.role==="boss"?"ボス":"雑魚"} · {enemy.attributes.join("・")||"属性未確認"}（敵{i+1}）</option>)}</select></label><label>配置<select value={p.position} onChange={e=>patchPlacement(index,{position:e.target.value as QuestWaveEnemyPlacement["position"]})}><option value="unknown">未確認</option>{Object.entries(QUEST_ENEMY_POSITIONS).map(([value,label])=><option key={value} value={value} disabled={placements.some((other,i)=>i!==index&&other.position===value)}>{label}</option>)}</select></label></fieldset>)}</div>
    <small>位置は読者から見た左・中央・右です。同じ位置には1体だけ登録できます。</small>
  </>;
}
export function QuestWaveEnemiesFields({quest,onChangeWave,onAddWave,onImportLegacy,hasLegacyWaves}:{quest:ArticleQuest;onChangeWave:(id:string,patch:Partial<QuestArticleWave>)=>void;onAddWave:()=>void;onImportLegacy:()=>void;hasLegacyWaves:boolean}) {
  return <section className="quest-enemy-waves-fields" id="quest-enemy-placements"><h3>WAVE別の敵数・配置</h3><p>上で登録した敵を各WAVEに割り当てます。共通の敵情報を使うため、同じ敵の名前や属性を何度も入力する必要はありません。</p>
    {(quest.waves??[]).map(w=><fieldset className="quest-enemy-wave-field" key={w.id} id={"quest-enemy-wave-"+w.id} aria-label={w.name+"の敵数・配置"}><legend>{w.name||"WAVE名未入力"}</legend><WaveEnemyFields wave={w} enemies={quest.enemies} onChange={patch=>onChangeWave(w.id,patch)}/></fieldset>)}
    {!quest.waves?.length&&hasLegacyWaves?<button type="button" onClick={onImportLegacy}>既存のWAVE番号を取り込んで配置を登録</button>:<button type="button" onClick={onAddWave}>＋ WAVEを追加して敵数・配置を登録</button>}
  </section>;
}
