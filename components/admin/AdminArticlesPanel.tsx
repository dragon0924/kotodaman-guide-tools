"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArticleContent, type ArticleCharacterLink } from "@/components/ArticleContent";
import { ArticleMediaAuthContext } from "@/components/ArticleMediaImage";
import { ArticleVisualEditor } from "./ArticleVisualEditor";
import { ArticleEventFields, emptyArticleEvent } from "./ArticleEventFields";
import { validateArticleRichContent } from "@/lib/articleRichText";
import { assertQuestArticle, emptyArticleQuest, QUEST_SECTIONS, questInputIssues, questTemplateSections } from "@/lib/questArticle";
import { QuestArticleFields } from "./QuestArticleFields";
import { syncQuestWaveSections } from "@/lib/questArticleLayout";
import type { Article, ArticleFile, ArticleStatus, ArticleTemplate, ArticleType, QuestArticleSectionKey } from "@/lib/types";

type ResponseData=ArticleFile&{revision:string;templates:ArticleTemplate[];characterOptions:ArticleCharacterLink[]};
type Recovery={version:1;revision:string;base:string;articles:Article[];at:string;selectedId?:string};
const RECOVERY_KEY="kotodaman-article-editor-recovery-v1";
const types:Record<ArticleType,string>={quest_guide:"クエスト攻略",character_review:"キャラ評価",deck_guide:"編成紹介",beginner_guide:"初心者向け解説",event_summary:"イベントまとめ"};
const identifier=()=>crypto.randomUUID();
export function AdminArticlesPanel({adminPassword}:{adminPassword:string}) {
  const router=useRouter();
  const [articles,setArticles]=useState<Article[]>([]),[selectedId,setSelectedId]=useState("");
  const [characters,setCharacters]=useState<ArticleCharacterLink[]>([]),[templates,setTemplates]=useState<ArticleTemplate[]>([]);
  const [revision,setRevision]=useState(""),[baseline,setBaseline]=useState("");
  const [message,setMessage]=useState(""),[error,setError]=useState(""),[loaded,setLoaded]=useState(false);
  const [saving,setSaving]=useState(false),[uploading,setUploading]=useState(false);
  const [mode,setMode]=useState<"edit"|"preview"|"mobile">("edit"),[previewSeen,setPreviewSeen]=useState(false);
  const [focusActivityId,setFocusActivityId]=useState<string>();
  const editActivity=(id:string)=>{setFocusActivityId(id);setMode("edit");};
  const [focusQuest,setFocusQuest]=useState<{key:QuestArticleSectionKey;target:"fields"|"body";waveId?:string;waveTarget?:"points"|"notes";nonce:number}>();
  const editQuest=(key:QuestArticleSectionKey,target:"fields"|"body",waveId?:string,waveTarget?:"points"|"notes")=>{setFocusQuest({key,target,waveId,waveTarget,nonce:Date.now()});setMode("edit");};
  const [recovery,setRecovery]=useState<Recovery|null>(null);
  const [reloadConfirm,setReloadConfirm]=useState(false);
  const [leaveConfirm,setLeaveConfirm]=useState<{proceed:()=>void}|null>(null);
  const savingRef=useRef(false),current=useRef(articles);
  useEffect(()=>{current.current=articles;},[articles]);
  const selected=articles.find(a=>a.id===selectedId)??articles[0];
  const dirty=!!baseline&&JSON.stringify(articles)!==baseline;
  const savedArticles:Article[]=baseline?JSON.parse(baseline):[];
  const savedSelected=savedArticles.find(a=>a.id===selected?.id);
  const selectedDirty=!!selected&&JSON.stringify(selected)!==JSON.stringify(savedSelected);
  const load=useCallback(async()=>{
    setError("");
    try {
      const response=await fetch("/api/admin/articles",{headers:{"x-admin-password":adminPassword},cache:"no-store"});
      if(!response.ok)throw new Error(response.status===401?"認証に失敗しました。":await response.text());
      const data=await response.json() as ResponseData;
      setArticles(data.articles);setBaseline(JSON.stringify(data.articles));setRevision(data.revision);setCharacters(data.characterOptions);setTemplates(data.templates);setLoaded(true);
      const params=new URLSearchParams(window.location.search),desired=params.get("article");
      setSelectedId(data.articles.some(a=>a.id===desired)?desired!:data.articles[0]?.id??"");setMode(params.get("preview")==="1"?"preview":"edit");setPreviewSeen(params.get("preview")==="1");
      const questSection=params.get("questSection"),questTarget=params.get("questTarget");
      if(questSection&&Object.hasOwn(QUEST_SECTIONS,questSection))setFocusQuest({key:questSection as QuestArticleSectionKey,target:questTarget==="body"?"body":"fields",waveId:params.get("questWave")??undefined,waveTarget:params.get("waveTarget")==="notes"?"notes":"points",nonce:Date.now()});
      try {const saved=JSON.parse(sessionStorage.getItem(RECOVERY_KEY)??"null");if(saved?.version===1&&Array.isArray(saved.articles)&&typeof saved.base==="string"&&typeof saved.revision==="string")setRecovery(saved);}catch{setRecovery(null);}
      setMessage("読み込み完了");
    } catch(e){setError(e instanceof Error?e.message:"記事を読み込めませんでした。");}
  },[adminPassword]);
  useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer);},[load]);
  useEffect(()=>{
    if(!loaded||!dirty)return;
    const timer=window.setTimeout(()=>{
      try {sessionStorage.setItem(RECOVERY_KEY,JSON.stringify({version:1,revision,base:baseline,articles,at:new Date().toISOString(),selectedId:selected?.id} satisfies Recovery));}
      catch {setMessage("復元用下書きの保存容量を超えました。保存ボタンで保存してください。");}
    },800);return()=>window.clearTimeout(timer);
  },[loaded,dirty,articles,revision,baseline,selected?.id]);
  useEffect(()=>{
    if(!dirty)return;
    const flush=()=>{try{sessionStorage.setItem(RECOVERY_KEY,JSON.stringify({version:1,revision,base:baseline,articles:current.current,at:new Date().toISOString(),selectedId:selected?.id} satisfies Recovery));}catch{/* Manual saving remains available when browser storage is full. */}};
    const warn=(e:BeforeUnloadEvent)=>{flush();e.preventDefault();e.returnValue="";};
    const switchTab=(e:Event)=>{const proceed=(e as CustomEvent<{proceed?:()=>void}>).detail?.proceed;if(!proceed)return;flush();e.preventDefault();setLeaveConfirm({proceed});};
    const navigate=(e:MouseEvent)=>{const target=e.target instanceof Element?e.target.closest("a"):null;if(target?.closest(".visual-article-canvas")||target?.target==="_blank"||e.ctrlKey||e.metaKey||e.shiftKey||e.button!==0)return;if(target?.href&&!target.getAttribute("href")?.startsWith("#")){flush();e.preventDefault();e.stopPropagation();const href=target.href;setLeaveConfirm({proceed:()=>{window.removeEventListener("beforeunload",warn);window.location.assign(href);}});}};
    window.addEventListener("beforeunload",warn);document.addEventListener("click",navigate,true);window.addEventListener("kotodaman-before-admin-tab-change",switchTab);
    return()=>{window.removeEventListener("beforeunload",warn);document.removeEventListener("click",navigate,true);window.removeEventListener("kotodaman-before-admin-tab-change",switchTab);};
  },[dirty,revision,baseline,selected?.id]);
  function update(patch:Partial<Article>) {
    if(patch.quest&&selected?.quest&&JSON.stringify(patch.quest.waves)!==JSON.stringify(selected.quest.waves)) {
      const removed=selected.quest.waves?.filter(w=>!patch.quest!.waves?.some(next=>next.id===w.id))??[];
      if(removed.length&&!window.confirm("WAVEと、その攻略ポイント・注意点を削除しますか？"))return;
      patch={...patch,sections:syncQuestWaveSections(patch.sections??selected.sections,patch.quest.waves??[],identifier)};
    }
    const reviewed=Object.keys(patch).some(key=>["title","type","slug","summary","sections","coverImage","toc","event","quest","publishedOn"].includes(key))&&!Object.hasOwn(patch,"contentReviewed");
    if(reviewed)setPreviewSeen(false);
    setArticles(list=>list.map(a=>{
      if(a.id!==selected?.id)return a;
      const next={...a,...patch};
      if(reviewed){next.contentReviewed=false;if(next.event&&!patch.event)next.event={...next.event,publicationReviewed:false};}
      return next;
    }));
  }
  function create(questGuide=false) {
    const now=new Date().toISOString();
    const article:Article={id:identifier(),title:questGuide?"新しいクエスト攻略":"無題の記事",type:"quest_guide",status:"draft",slug:"",summary:"",contentReviewed:false,toc:questGuide,createdAt:now,updatedAt:now,sections:questGuide?questTemplateSections(identifier):[{id:identifier(),heading:"本文",hideHeading:true,blocks:[{id:identifier(),type:"paragraph",content:""}]}],...(questGuide?{quest:emptyArticleQuest()}:{})};
    setArticles(list=>[...list,article]);selectArticle(article.id);setMode("edit");setPreviewSeen(false);
  }
  function selectArticle(id:string) {
    setSelectedId(id);setPreviewSeen(false);
    const url=new URL(window.location.href);url.searchParams.set("article",id);window.history.replaceState(null,"",url);
  }
  async function save() {
    if(savingRef.current||uploading||!loaded||!selected)return;
    if(selected.status==="published"&&selected.quest){const issues=questInputIssues(selected.quest).filter(i=>i.severity==="error");if(issues.length){setError("公開前の入力チェック："+issues.map(i=>i.message).join(" / "));return;}}
    if(selected.status==="published"&&selected.contentReviewed===false){setError("公開前プレビューを確認し、公開前確認にチェックを入れてください。");return;}
    savingRef.current=true;setSaving(true);setError("");
    const captured=JSON.stringify(selected),savedId=selected.id,now=new Date().toISOString();
    const payload={article:{...selected,updatedAt:now}};
    try {
      const response=await fetch("/api/admin/articles",{method:"PATCH",headers:{"content-type":"application/json","x-admin-password":adminPassword,"if-match":revision},body:JSON.stringify(payload)});
      if(!response.ok)throw new Error((response.status===412?"同時編集による競合です。復元下書きを保持しています。 ":"")+await response.text());
      const data=await response.json() as ResponseData;setBaseline(JSON.stringify(data.articles));setRevision(data.revision);
      const merged=current.current.map(a=>{
        if(a.id===savedId&&JSON.stringify(a)===captured)return data.articles.find(saved=>saved.id===a.id)!;
        if(JSON.stringify(a)===JSON.stringify(savedArticles.find(saved=>saved.id===a.id)))return data.articles.find(saved=>saved.id===a.id)??a;
        return a;
      });
      current.current=merged;setArticles(merged);
      if(JSON.stringify(merged)===JSON.stringify(data.articles)){sessionStorage.removeItem(RECOVERY_KEY);setRecovery(null);setMessage("保存しました");}
      else setMessage("選択記事を保存しました。ほかの記事や保存中の追加変更は未保存です。");
    } catch(e){setError(e instanceof Error?e.message:"保存できませんでした。");}
    finally{savingRef.current=false;setSaving(false);}
  }
  async function deleteSelected() {
    if(!selected||savingRef.current||uploading||!window.confirm(selected.title+"を削除しますか？"))return;
    if(!savedSelected){setArticles(list=>list.filter(a=>a.id!==selected.id));setSelectedId("");return;}
    savingRef.current=true;setSaving(true);setError("");
    try {
      const response=await fetch("/api/admin/articles",{method:"DELETE",headers:{"content-type":"application/json","x-admin-password":adminPassword,"if-match":revision},body:JSON.stringify({id:selected.id})});
      if(!response.ok)throw new Error(await response.text());
      const data=await response.json() as ResponseData;
      const remaining=current.current.filter(a=>a.id!==selected.id);current.current=remaining;setArticles(remaining);setSelectedId("");setBaseline(JSON.stringify(data.articles));setRevision(data.revision);setMessage("記事を削除しました");
    }catch(e){setError(e instanceof Error?e.message:"記事を削除できませんでした。");}
    finally{savingRef.current=false;setSaving(false);}
  }
  function restoreRecovery() {
    if(!recovery)return;
    try {
      const ids=new Set(characters.map(c=>c.id));recovery.articles.forEach(a=>{assertQuestArticle({...a,status:"draft"},ids);validateArticleRichContent({...a,status:"draft"},ids);});
      if(recovery.revision===revision){setArticles(recovery.articles);selectArticle(recovery.selectedId??recovery.articles.at(-1)?.id??"");}
      else {
        const original=JSON.parse(recovery.base) as Article[];
        const copies=recovery.articles.filter(a=>JSON.stringify(a)!==JSON.stringify(original.find(b=>b.id===a.id))).map(a=>({...a,id:identifier(),title:a.title+"（復元）",slug:"",status:"draft" as const,contentReviewed:false,...(a.event?{event:{...a.event,publicationReviewed:false}}:{})}));
        setArticles(list=>[...list,...copies]);if(copies[0])selectArticle(copies[0].id);
      }
      // Keep the recovery copy until a successful save; restoring it must not delete the last durable browser snapshot.
      setRecovery(null);setMode("edit");setMessage("復元しました。内容を確認して保存してください。");
    } catch(e){setError(e instanceof Error?e.message:"復元データを確認してください。");}
  }
  const settings=selected?<>
    <details open><summary>記事設定</summary><div className="visual-settings-fields">
      <label>記事タイプ<select value={selected.type} disabled={!!selected.quest} onChange={e=>{const type=e.target.value as ArticleType;update({type,...(type==="event_summary"&&!selected.event?{event:emptyArticleEvent()}:{} )});}}>{Object.entries(types).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
      {selected.quest?<p className="muted">クエスト共通テンプレートを使用中です。本文のセクション操作で表示順を変更できます。</p>:<><button type="button" onClick={()=>{const template=templates.find(t=>t.type===selected.type);if(template&&window.confirm("現在の本文をテンプレートで置き換えますか？"))update({sections:template.sections.map(s=>({id:identifier(),heading:s.heading,blocks:s.defaultBlocks.map(b=>({id:identifier(),type:b.type,content:b.content}))}))});}}>記事タイプのテンプレートを適用</button>{selected.type==="quest_guide"&&!selected.event?<button type="button" onClick={()=>update({quest:emptyArticleQuest(),toc:true,sections:[...questTemplateSections(identifier),...selected.sections]})}>クエスト共通項目を追加（既存本文を保持）</button>:null}</>}
      <label>記事の状態<select aria-label="記事の状態" value={selected.status} onChange={e=>update({status:e.target.value as ArticleStatus})}><option value="draft">下書き（非公開）</option><option value="published">公開</option><option value="archived">保管（非公開）</option></select></label>
      <label>URL名<input aria-label="記事URL名" value={selected.slug??""} onChange={e=>update({slug:e.target.value})}/></label>
      <label>公開日（日本時間・未登録なら推測しません）<input type="date" value={selected.publishedOn??""} onChange={e=>update({publishedOn:e.target.value||undefined})}/></label>
      <label>記事概要<textarea aria-label="記事概要" rows={4} value={selected.summary??""} onChange={e=>update({summary:e.target.value})}/></label>
      <label className="visual-check"><input type="checkbox" disabled={!!selected.quest} checked={selected.quest?true:selected.toc??false} onChange={e=>update({toc:e.target.checked})}/>目次を自動生成{selected.quest?"（クエスト記事は常時表示）":""}</label>
      <label className="visual-check"><input aria-label="公開前確認" type="checkbox" disabled={!previewSeen} checked={selected.contentReviewed===true} onChange={e=>update({contentReviewed:e.target.checked,...(selected.event?{event:{...selected.event,publicationReviewed:e.target.checked}}:{})})}/>プレビューで内容・情報源を確認済み</label>
      {!previewSeen?<p className="muted">公開前プレビューを開くと確認できます。本文を編集したら再確認してください。</p>:null}
      <small>記事ID：{selected.id}</small>
    </div></details>
    {selected.event?<details><summary>開催期間・施策・公式情報</summary><ArticleEventFields event={selected.event} characters={characters} onChange={event=>update({event})} onEditActivity={editActivity}/></details>:null}
    {selected.editHistory?.length?<details><summary>編集履歴</summary><ul>{selected.editHistory.map((h,i)=><li key={i}>{new Date(h.at).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})} {h.note}</li>)}</ul></details>:null}
  </>:null;
  return <ArticleMediaAuthContext.Provider value={adminPassword}><section className={"article-studio"+(saving?" is-saving":"")}>
    <header className="article-studio-header"><div><h1>記事エディター</h1><p className="muted">完成記事に近い本文をクリックして編集できます。</p></div>
      <div className="article-studio-actions">
        <select aria-label="編集する記事" value={selected?.id??""} disabled={saving||uploading} onChange={e=>selectArticle(e.target.value)}>{articles.map(a=><option key={a.id} value={a.id}>{a.title}（{a.status==="draft"?"下書き":a.status==="published"?"公開":"保管"}）</option>)}</select>
        <button type="button" disabled={saving||uploading} onClick={()=>create()}>新規作成</button>
        <button type="button" disabled={saving||uploading} onClick={()=>create(true)}>クエスト攻略を新規作成</button>
        <button type="button" disabled={saving||uploading} onClick={()=>{if(dirty)setReloadConfirm(true);else void load();}}>再読み込み</button>
        <button type="button" disabled={!selected||saving||uploading} onClick={()=>void deleteSelected()}>記事削除</button>
        <button type="button" className="primary" disabled={!selectedDirty||saving||uploading} onClick={()=>void save()}>{saving?"保存中…":selected?.status==="published"?(savedSelected?.status==="published"?"公開記事を更新":"公開する"):"下書き・保管を保存"}</button>
      </div>
    </header>
    <div className="article-studio-state" role="status"><strong>{saving?"保存中":uploading?"画像アップロード中":dirty?"未保存の変更あり":"保存済み"}</strong><span>{message}</span>{dirty?<small>変更内容はこのタブに自動保存し、再読み込み後に復元できます。</small>:null}</div>
    {error?<p className="status error" role="alert">{error}</p>:null}
    {leaveConfirm?<div className="article-recovery" role="alert"><strong>未保存の変更があります</strong><p>移動すると編集画面を閉じます。変更内容は復元用下書きとして保持します。</p><button type="button" disabled={saving||uploading} onClick={()=>{setLeaveConfirm(null);}}>移動せず編集を続ける</button><button type="button" disabled={saving||uploading} onClick={()=>{const proceed=leaveConfirm.proceed;setLeaveConfirm(null);proceed();}}>復元用下書きを残して移動</button></div>:null}
    {reloadConfirm?<div className="article-recovery" role="alert"><strong>未保存の変更があります</strong><p>復元用下書きを残して、最後に保存した内容を読み直します。</p><button type="button" disabled={saving||uploading} onClick={()=>{try{sessionStorage.setItem(RECOVERY_KEY,JSON.stringify({version:1,revision,base:baseline,articles:current.current,at:new Date().toISOString(),selectedId:selected?.id} satisfies Recovery));}catch{setError("復元用下書きを保存できません。先に保存ボタンで保存してください。");return;}setReloadConfirm(false);void load();}}>保存済みの内容を読み直す</button><button type="button" onClick={()=>setReloadConfirm(false)}>編集を続ける</button></div>:null}
    {recovery?<div className="article-recovery"><strong>復元できる下書きがあります</strong><p>{recovery.revision===revision?"前回の未保存変更を復元できます。":"記事が別の操作で更新されています。復元内容を新しい下書きとして開き、既存記事を保護します。"}</p><button type="button" onClick={restoreRecovery}>{recovery.revision===revision?"下書きを復元":"新しい下書きとして復元"}</button><button type="button" onClick={()=>{setRecovery(null);sessionStorage.removeItem(RECOVERY_KEY);}}>復元データを破棄</button></div>:null}
    {selected?<><div className="article-studio-mode" role="group" aria-label="表示モード">{(["edit","preview","mobile"] as const).map(value=><button type="button" key={value} className={mode===value?"active":""} onClick={()=>{setMode(value);if(value!=="edit")setPreviewSeen(true);}}>{value==="edit"?"編集":value==="preview"?"公開前プレビュー":"スマホプレビュー"}</button>)}<button type="button" disabled={dirty||saving||uploading} title={dirty?"変更を保存してから確認できます":"保存済み記事を実際のページ幅で確認"} onClick={()=>router.push("/admin/article-layout-preview?article="+encodeURIComponent(selected.id))}>保存済み記事を3カラムで確認</button></div>
      {mode==="edit"?<ArticleVisualEditor key={selected.id} article={selected} characters={characters} secret={adminPassword} onChange={update} onError={setError} onUploading={setUploading} settings={settings} beforeBody={selected.quest?<fieldset className="quest-fields-boundary" disabled={saving||uploading}><QuestArticleFields key={selected.id} quest={selected.quest} onChange={quest=>update({quest})} characters={characters} articles={articles} secret={adminPassword} onError={setError} onUploading={setUploading} focus={focusQuest} onFocusBody={key=>editQuest(key,"body")} onFocusWave={(waveId,waveTarget)=>editQuest("phases","body",waveId,waveTarget)}/></fieldset>:null} focusActivityId={focusActivityId} focusQuestSection={focusQuest} onEditQuestData={key=>editQuest(key,"fields")}/>:
        <div className={"article-studio-preview"+(mode==="mobile"?" mobile":"")}><ArticleContent article={selected} characters={characters} relatedArticles={articles.map(a=>({id:a.id,title:a.title,href:"/admin/article-layout-preview?article="+encodeURIComponent(a.id)}))} preview onEditActivity={editActivity} onEditQuestSection={editQuest} previewLabel={savedSelected?.status==="published"?"管理者プレビュー（編集内容の一般表示への反映は保存後）":undefined}/></div>}
    </>:<p className="muted">新規作成から記事を追加してください。</p>}
  </section></ArticleMediaAuthContext.Provider>;
}
