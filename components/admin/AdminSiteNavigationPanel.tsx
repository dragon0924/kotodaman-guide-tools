"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ArticleCharacterPicker} from "./ArticleCharacterPicker";
import type {NavigationArticle,NavigationCharacter,SiteNavigationSettings} from "@/lib/siteNavigation";

type ResponseData={settings:SiteNavigationSettings;revision:string;characterOptions:NavigationCharacter[];articleOptions:NavigationArticle[]};
type ListKey="newCharacterIds"|"recommendedArticleIds";
const normalize=(text:string)=>text.normalize("NFKC").toLowerCase();
export function AdminSiteNavigationPanel({adminPassword}:{adminPassword:string}){
  const router=useRouter();
  const [data,setData]=useState<ResponseData>(),[settings,setSettings]=useState<SiteNavigationSettings>(),[baseline,setBaseline]=useState("");
  const [query,setQuery]=useState(""),[picker,setPicker]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  const [leave,setLeave]=useState<(()=>void)|null>(null),busy=useRef(false);
  const dirty=!!settings&&JSON.stringify(settings)!==baseline;
  const load=useCallback(async()=>{
    try{const response=await fetch("/api/admin/site-navigation",{headers:{"x-admin-password":adminPassword},cache:"no-store"});if(!response.ok)throw new Error(await response.text());const value=await response.json() as ResponseData;setError("");setData(value);setSettings(value.settings);setBaseline(JSON.stringify(value.settings));setMessage("読み込み完了");}
    catch(e){setError(e instanceof Error?e.message:"読み込めませんでした。");}
  },[adminPassword]);
  useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer);},[load]);
  useEffect(()=>{
    const unload=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue="";}};
    const switchTab=(e:Event)=>{if(dirty){e.preventDefault();setLeave(()=>(e as CustomEvent<{proceed:()=>void}>).detail.proceed);}};
    const navigate=(e:MouseEvent)=>{
      const anchor=e.target instanceof Element?e.target.closest("a"):null;
      if(!dirty||!anchor||anchor.target==="_blank"||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button!==0||anchor.getAttribute("href")?.startsWith("#"))return;
      const destination=new URL(anchor.href);
      if(destination.origin!==window.location.origin)return;
      e.preventDefault();e.stopPropagation();
      setLeave(()=>()=>router.push(destination.pathname+destination.search+destination.hash));
    };
    window.addEventListener("beforeunload",unload);window.addEventListener("kotodaman-before-admin-tab-change",switchTab);
    document.addEventListener("click",navigate,true);
    return()=>{window.removeEventListener("beforeunload",unload);window.removeEventListener("kotodaman-before-admin-tab-change",switchTab);document.removeEventListener("click",navigate,true);};
  },[dirty,router]);
  const update=(key:ListKey,ids:string[])=>setSettings(s=>s?{...s,[key]:ids}:s);
  function move(key:ListKey,index:number,delta:number){if(!settings)return;const ids=[...settings[key]];[ids[index],ids[index+delta]]=[ids[index+delta],ids[index]];update(key,ids);}
  async function save(){
    if(busy.current||!data||!settings)return;busy.current=true;setSaving(true);setError("");
    try{const response=await fetch("/api/admin/site-navigation",{method:"PUT",headers:{"x-admin-password":adminPassword,"content-type":"application/json","if-match":data.revision},body:JSON.stringify(settings)});if(!response.ok)throw new Error(await response.text());const next=await response.json() as ResponseData;setData(next);setSettings(next.settings);setBaseline(JSON.stringify(next.settings));setMessage("保存しました。サイト共通の情報メニューに反映しました。");window.dispatchEvent(new Event("kotodaman-site-navigation-saved"));}
    catch(e){setError(e instanceof Error?e.message:"保存できませんでした。");}finally{busy.current=false;setSaving(false);}
  }
  function actions(key:ListKey,id:string,label:string,index:number){return <div className="navigation-admin-actions"><button type="button" disabled={saving||index===0} aria-label={label+"を上へ"} onClick={()=>move(key,index,-1)}>↑ 上へ</button><button type="button" disabled={saving||index===(settings?.[key].length??0)-1} aria-label={label+"を下へ"} onClick={()=>move(key,index,1)}>↓ 下へ</button><button type="button" disabled={saving} aria-label={label+"を表示対象から外す"} onClick={()=>update(key,settings![key].filter(x=>x!==id))}>外す</button></div>;}
  return <section className="admin-panel navigation-admin-panel"><header className="section-heading"><div><h2>サイトの情報メニュー</h2><p>新登場キャラとおすすめ記事の表示対象・順序を管理します。</p></div><button type="button" className="primary" disabled={!dirty||saving} onClick={()=>void save()}>{saving?"保存中…":"表示設定を保存"}</button></header>
    <p role="status">{dirty?"未保存の変更あり":"保存済み"} · {message}</p>{error?<p role="alert" className="status error">{error}</p>:null}
    {leave?<div role="alert" className="article-recovery"><p>未保存の表示設定があります。</p><button type="button" onClick={()=>setLeave(null)}>編集を続ける</button><button type="button" onClick={()=>{const proceed=leave;setLeave(null);proceed();}}>保存せず移動</button></div>:null}
    {data&&settings?<div className="navigation-admin-columns">
      <section><h3>新登場キャラクター <small>{settings.newCharacterIds.length}/8</small></h3><p>ゲーム内の登場時期を確認して選択してください。DBへの追加順は使いません。</p>
        <ol className="navigation-admin-selection">{settings.newCharacterIds.map((id,index)=>{const c=data.characterOptions.find(c=>c.id===id);return <li key={id}><div className="navigation-admin-item">{c?.imageUrl?<img src={c.imageUrl} alt="" width={48} height={48}/>:null}<span><strong>{c?.name??"未登録のキャラ"}</strong><small>{c?.attributes?.join("・")||c?.attribute} / {c?.species??c?.race}</small><small>{id}</small></span></div>{actions("newCharacterIds",id,c?.name??id,index)}</li>;})}</ol>
        <button type="button" disabled={saving||settings.newCharacterIds.length>=8} onClick={()=>setPicker(true)}>＋ キャラDBから選ぶ</button>
      </section>
      <section><h3>おすすめ記事 <small>{settings.recommendedArticleIds.length}/6</small></h3><p>公開済みの記事のみ選択できます。開催中イベント・おすすめ・新着の間で同じ記事を重複表示しません。</p>
        <ol className="navigation-admin-selection">{settings.recommendedArticleIds.map((id,index)=>{const a=data.articleOptions.find(a=>a.id===id);return <li key={id}><strong>{a?.title??"非公開または削除済みの記事"}</strong>{actions("recommendedArticleIds",id,a?.title??id,index)}</li>;})}</ol>
        <label>公開記事を検索<input type="search" aria-label="おすすめ記事を検索" value={query} onChange={e=>setQuery(e.target.value)}/></label>
        {!data.articleOptions.length?<p className="muted">公開済みの記事がありません。下書きは選択・表示されません。</p>:<div className="navigation-admin-article-options">{data.articleOptions.filter(a=>!settings.recommendedArticleIds.includes(a.id)&&normalize(a.title).includes(normalize(query.trim()))).slice(0,20).map(a=><button key={a.id} type="button" disabled={saving||settings.recommendedArticleIds.length>=6} onClick={()=>update("recommendedArticleIds",[...settings.recommendedArticleIds,a.id])}>＋ {a.title}</button>)}</div>}
      </section>
    </div>:null}
    <button type="button" disabled={saving} onClick={()=>dirty?setLeave(()=>()=>void load()):void load()}>保存済み設定を読み直す</button>
    <p className="navigation-admin-links">保存後の表示確認：{settings?.newCharacterIds[0]?<><Link href={"/characters/"+encodeURIComponent(settings.newCharacterIds[0])} target="_blank">キャラ詳細</Link> · </>:null}<Link href="/articles" target="_blank">公開記事一覧</Link></p>
    {picker&&data&&settings?<ArticleCharacterPicker characters={data.characterOptions.filter(c=>!settings.newCharacterIds.includes(c.id))} onClose={()=>setPicker(false)} onChoose={c=>{if(settings.newCharacterIds.length<8&&!settings.newCharacterIds.includes(c.id))update("newCharacterIds",[...settings.newCharacterIds,c.id]);setPicker(false);}}/>:null}
  </section>;
}
