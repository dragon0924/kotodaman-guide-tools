"use client";
import { useState } from "react";
import Image from "next/image";
import type { ArticleCharacterLink } from "@/components/ArticleContent";
const normalize=(text:string)=>text.normalize("NFKC").toLowerCase().replace(/[\u3041-\u3096]/gu,ch=>String.fromCharCode(ch.charCodeAt(0)+0x60));
export function ArticleCharacterPicker({characters,initialQuery="",onChoose,onClose}:{characters:ArticleCharacterLink[];initialQuery?:string;onChoose:(c:ArticleCharacterLink)=>void;onClose:()=>void}) {
  const [query,setQuery]=useState(initialQuery);
  const results=characters.filter(c=>normalize(c.name).includes(normalize(query.trim()))||c.id.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="article-picker-backdrop"><section role="dialog" aria-modal="true" aria-label="キャラクターを選択" className="article-character-picker" onKeyDown={e=>{if(e.key==="Escape")onClose();}}>
    <div className="section-heading"><h2>キャラクターを選択</h2><button type="button" onClick={onClose}>閉じる</button></div>
    <label>キャラ名で検索<input aria-label="キャラ名で検索" autoFocus type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="うつつ"/></label>
    <p className="muted">{results.length}件。画像・属性・種族・IDを確認して選択してください。</p>
    <div className="article-picker-results">{results.slice(0,50).map(c=><button key={c.id} type="button" className="article-picker-candidate" onClick={()=>onChoose(c)}>
      {c.imageUrl?<Image src={c.imageUrl} alt="" width={56} height={56} sizes="56px" loading="lazy"/>:<span>画像なし</span>}
      <span><strong>{c.name}</strong><small>{c.attributes?.join("・")||c.attribute} / {c.species||c.race||"種族未取得"}</small><small>持ち文字：{c.letters?.join("・")||"未取得"}</small><small>{c.id}</small></span>
    </button>)}</div>{results.length>50?<p>50件を表示中です。名前を入力して絞り込めます。</p>:null}
  </section></div>;
}
