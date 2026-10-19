"use client";
import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from "react";
import type { Editor } from "@tiptap/react";
import type { Article, ArticleBlock, ArticleSection, RichTextDocument, QuestArticleSectionKey } from "@/lib/types";
import { QuestSectionData } from "@/components/QuestArticleContent";
import { QuestBossPortrait } from "@/components/QuestGuideParts";
import type { ArticleCharacterLink } from "@/components/ArticleContent";
import { ArticleBodyBlock } from "@/components/RichArticleBody";
import { ArticleMediaImage } from "@/components/ArticleMediaImage";
import { legacyBlockDocument, richTextPlain } from "@/lib/articleRichText";
import { RichBlockEditor } from "./RichBlockEditor";
import { ArticleEditorToolbar } from "./ArticleEditorToolbar";
import { ArticleCharacterPicker } from "./ArticleCharacterPicker";
import { activityEditorSection, activitySectionId, applyEventEditorPatch, eventEditorView } from "@/lib/articleEventContent";
import { eventPeriodText } from "@/lib/articleEvents";
import { EventPeriodFields } from "./EventPeriodFields";
import { ArticleImageWidthFields } from "./ArticleImageWidthFields";

const id=()=>crypto.randomUUID();
const textDoc=(type="paragraph",text="",level?:number):RichTextDocument=>({type:"doc",content:[{type,...(level?{attrs:{level}}:{}),...(text?{content:[{type:"text",text}]}:{})}]});
const tableDoc=():RichTextDocument=>({type:"doc",content:[{type:"table",content:Array.from({length:3},(_,row)=>({type:"tableRow",content:Array.from({length:3},(_,column)=>({type:row===0?"tableHeader":"tableCell",attrs:{colspan:1,rowspan:1,colwidth:null},content:[{type:"paragraph",content:[{type:"text",text:row===0?["項目","内容","備考"][column]:"入力"}]}]}))}))}]});
const labels:Record<ArticleBlock["type"],string>={paragraph:"本文",point:"ポイント",warning:"注意",image:"画像",characterCard:"キャラカード",collapse:"折りたたみ",table:"表",questInfoTable:"クエスト情報表",characterList:"キャラ一覧",deckExample:"編成例",boardPattern:"盤面パターン",wordExamples:"ことば例"};
export function ArticleVisualEditor({article:sourceArticle,characters,secret,onChange:onSourceChange,onError,onUploading,settings,beforeBody,focusActivityId,focusQuestSection,onEditQuestData}:{article:Article;characters:ArticleCharacterLink[];secret:string;onChange:(patch:Partial<Article>)=>void;onError:(message:string)=>void;onUploading:(busy:boolean)=>void;settings:ReactNode;beforeBody?:ReactNode;focusActivityId?:string;focusQuestSection?:{key:QuestArticleSectionKey;target:"fields"|"body";waveId?:string;waveTarget?:"points"|"notes";nonce:number};onEditQuestData?:(key:QuestArticleSectionKey)=>void}) {
  const article=eventEditorView(sourceArticle);
  const onChange=(patch:Partial<Article>)=>onSourceChange(applyEventEditorPatch(sourceArticle,patch));
  const [selectedId,setSelectedId]=useState(article.sections[0]?.blocks[0]?.id??"");
  const [targetSectionId,setTargetSectionId]=useState(article.sections[0]?.id??"");
  const [revealBlockId,setRevealBlockId]=useState("");
  const [editor,setEditor]=useState<Editor|null>(null);
  const [picker,setPicker]=useState<"link"|"card"|"cardReplace"|null>(null);
  const [settingsOpen,setSettingsOpen]=useState(true);
  const [undo,setUndo]=useState<ArticleSection[][]>([]),[redo,setRedo]=useState<ArticleSection[][]>([]);
  const focusedQuestSectionId=sourceArticle.sections.find(s=>focusQuestSection?.waveId?s.questWave?.id===focusQuestSection.waveId&&s.questWave.target===(focusQuestSection.waveTarget??"points"):s.questSection===focusQuestSection?.key)?.id;
  const dragId=useRef(""),uploadInput=useRef<HTMLInputElement>(null),titleInput=useRef<HTMLTextAreaElement>(null),current=useRef(article);
  useEffect(()=>{current.current=article;},[article]);
  useEffect(()=>{if(revealBlockId){const block=Array.from(document.querySelectorAll<HTMLElement>("[data-block-id]")).find(el=>el.dataset.blockId===revealBlockId);block?.scrollIntoView({block:"start"});}},[revealBlockId]);
  useEffect(()=>{if(focusActivityId){const section=document.getElementById("edit-"+activitySectionId(focusActivityId));section?.scrollIntoView({block:"start"});section?.querySelector("input")?.focus();}},[focusActivityId]);
  useEffect(()=>{if(focusQuestSection?.target==="body"&&focusedQuestSectionId){const section=document.getElementById("edit-"+focusedQuestSectionId);section?.scrollIntoView({block:"start"});(section?.querySelector<HTMLElement>("[contenteditable=true]")??section?.querySelector<HTMLElement>("input"))?.focus({preventScroll:true});}},[focusQuestSection,focusedQuestSectionId]);
  useEffect(()=>{const adjust=()=>{const title=titleInput.current;if(title){title.style.height="auto";title.style.height=title.scrollHeight+"px";}};adjust();window.addEventListener("resize",adjust);return()=>window.removeEventListener("resize",adjust);},[article.title]);
  const selectedSectionIndex=article.sections.findIndex(s=>s.blocks.some(b=>b.id===selectedId));
  const sectionIndex=selectedSectionIndex>=0?selectedSectionIndex:Math.max(0,article.sections.findIndex(s=>s.id===targetSectionId));
  const blockIndex=article.sections[sectionIndex]?.blocks.findIndex(b=>b.id===selectedId)??-1;
  const selected=article.sections[sectionIndex]?.blocks[blockIndex];
  const active=editor&&!editor.isDestroyed?editor:null;
  function patchBlock(blockId:string,patch:Partial<ArticleBlock>) {
    onChange({sections:current.current.sections.map(s=>({...s,blocks:s.blocks.map(b=>b.id===blockId?{...b,...patch}:b)}))});
  }
  function structure(sections:ArticleSection[]) {setUndo(history=>[...history.slice(-49),current.current.sections]);setRedo([]);onChange({sections});}
  function moveSection(sectionId:string,direction:number) {
    const sections=[...current.current.sections],index=sections.findIndex(s=>s.id===sectionId);
    const campaign=!!sections[index]?.eventActivity;
    const peers=sections.map((s,i)=>({s,i})).filter(({s})=>!!s.eventActivity===campaign);
    const next=peers[peers.findIndex(({s})=>s.id===sectionId)+direction]?.i;
    if(next===undefined)return;
    const [section]=sections.splice(index,1);sections.splice(next,0,section);structure(sections);
  }
  function addActivity() {
    const section=activityEditorSection({id:"activity-"+id(),name:"新しい施策",kind:"campaign",period:{availability:"limited"},summary:"",characterIds:[],officialUrl:sourceArticle.event?.officialUrls[0]??""});
    const sections=[...current.current.sections],last=sections.findLastIndex(s=>s.eventActivity);
    sections.splice(last<0?Math.min(1,sections.length):last+1,0,section);structure(sections);setSelectedId(section.blocks[0].id);
  }
  function changePeriod(activityId:string,period:NonNullable<Article["event"]>["activities"][number]["period"]) {
    const event=sourceArticle.event!;onSourceChange({event:{...event,publicationReviewed:false,activities:event.activities.map(a=>a.id===activityId?{...a,period}:a)}});
  }
  function insert(block:ArticleBlock,after=selectedId) {
    const base=current.current;
    if(!base.sections.length){structure([{id:id(),heading:"本文",blocks:[block]}]);}
    else {const found=base.sections.findIndex(s=>s.blocks.some(b=>b.id===after));const si=found>=0?found:Math.max(0,base.sections.findIndex(s=>s.id===targetSectionId));structure(base.sections.map((s,index)=>{if(index!==si)return s;const blocks=[...s.blocks],bi=blocks.findIndex(b=>b.id===after);blocks.splice(bi<0?blocks.length:bi+1,0,block);return {...s,blocks};}));}
    setSelectedId(block.id);setEditor(null);
    if(sourceArticle.quest)setRevealBlockId(block.id);
  }
  function add(kind:string) {
    if(kind==="image"){uploadInput.current?.click();return;}
    if(kind==="characterCard"){setPicker("card");return;}
    const level=kind.startsWith("h")?Number(kind.slice(1)):undefined;
    const type=level?"paragraph":kind as ArticleBlock["type"];
    const richText=type==="table"?tableDoc():textDoc(level?"heading":"paragraph",level?"新しい見出し":"",level);
    insert({id:id(),type,content:richTextPlain(richText),richText,...(type==="collapse"?{collapseTitle:"詳しく見る"}:{})});
  }
  function move(blockId:string,targetSection:number,targetIndex:number) {
    const sections=current.current.sections.map(s=>({...s,blocks:[...s.blocks]})),si=sections.findIndex(s=>s.blocks.some(b=>b.id===blockId));
    if(si<0)return;const bi=sections[si].blocks.findIndex(b=>b.id===blockId),[block]=sections[si].blocks.splice(bi,1);
    const destination=si===targetSection&&bi<targetIndex?targetIndex-1:targetIndex;
    sections[targetSection].blocks.splice(destination,0,block);structure(sections);
  }
  function restore(snapshot:ArticleSection[]) {
    const live=current.current.sections,blocks=new Map(live.flatMap(s=>s.blocks).map(b=>[b.id,b]));
    return snapshot.map(s=>({...s,heading:live.find(x=>x.id===s.id)?.heading??s.heading,blocks:s.blocks.map(b=>blocks.get(b.id)??b)}));
  }
  async function upload(file:File,after=selectedId,cover=false) {
    const startingArticle=current.current.id;onUploading(true);onError("");
    try {
      const form=new FormData();form.append("image",file);form.append("purpose",cover?"banner":"article");
      const response=await fetch("/api/admin/article-media",{method:"POST",headers:{"x-admin-password":secret},body:form});
      if(!response.ok)throw new Error(await response.text());
      const data=await response.json() as {src:string;width:number;height:number};
      if(current.current.id!==startingArticle)return;
      const image={src:data.src,alt:"",width:data.width,height:data.height,widthPercent:100,align:"center" as const};
      if(cover)onChange({coverImage:image});else insert({id:id(),type:"image",content:"",image},after);
    } catch(error){onError(error instanceof Error?error.message:"画像をアップロードできませんでした。");}
    finally{onUploading(false);}
  }
  function resize(event:PointerEvent<HTMLButtonElement>,block:ArticleBlock) {
    if(!block.image)return;event.preventDefault();
    const width=event.currentTarget.closest(".visual-block-content")?.clientWidth??1,start=event.clientX;
    const widthKey=window.matchMedia("(max-width: 760px)").matches?"mobileWidthPercent":"widthPercent";
    const original=block.image[widthKey]??block.image.widthPercent??100;
    const change=(e:globalThis.PointerEvent)=>patchBlock(block.id,{image:{...block.image!,[widthKey]:Math.round(Math.max(10,Math.min(100,original+(e.clientX-start)/width*100)))}});
    const end=()=>{window.removeEventListener("pointermove",change);window.removeEventListener("pointerup",end);};
    window.addEventListener("pointermove",change);window.addEventListener("pointerup",end,{once:true});
  }
  return <>
    <ArticleEditorToolbar editor={active} onCharacterLink={()=>setPicker("link")} onInsert={add} settingsOpen={settingsOpen} onToggleSettings={()=>setSettingsOpen(!settingsOpen)} canUndoBlocks={!!undo.length} canRedoBlocks={!!redo.length}
      context={sourceArticle.quest?<div className="quest-toolbar-destination"><label>編集・挿入先<select aria-label="編集・挿入先" value={article.sections[sectionIndex]?.id??""} onChange={e=>{const section=article.sections.find(s=>s.id===e.target.value);if(section){setTargetSectionId(section.id);setSelectedId(section.blocks[0]?.id??"");setEditor(null);}}}>{article.sections.map(s=><option key={s.id} value={s.id}>{s.heading||"本文"}</option>)}</select></label><button type="button" onClick={()=>{const section=document.getElementById("edit-"+article.sections[sectionIndex]?.id);section?.scrollIntoView({block:"start"});(section?.querySelector<HTMLElement>("[contenteditable=true]")??section?.querySelector<HTMLElement>("input"))?.focus({preventScroll:true});}}>本文へ移動</button><button type="button" onClick={()=>add("image")}>画像を挿入</button><button type="button" onClick={()=>add("table")}>表を挿入</button></div>:undefined}
      undoBlocks={()=>{const snapshot=undo.at(-1)!;setRedo(list=>[...list,current.current.sections]);setUndo(list=>list.slice(0,-1));onChange({sections:restore(snapshot)});}}
      redoBlocks={()=>{const snapshot=redo.at(-1)!;setUndo(list=>[...list,current.current.sections]);setRedo(list=>list.slice(0,-1));onChange({sections:restore(snapshot)});}}/>
    {beforeBody?<div className="quest-editor-common-fields" onFocusCapture={()=>setEditor(null)}>{beforeBody}</div>:null}
    <input ref={uploadInput} type="file" accept="image/png,image/jpeg,image/webp,image/avif" hidden onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.target.value="";}}/>
    <div className={"visual-editor-layout"+(settingsOpen?"":" settings-closed")}>
      <div className="visual-article-canvas">
        <div className={sourceArticle.quest?"quest-article-title quest-editor-title":undefined}>
          {sourceArticle.quest?<div className="quest-title-boss"><QuestBossPortrait quest={sourceArticle.quest} characters={characters}/>{onEditQuestData?<button type="button" onClick={()=>onEditQuestData("overview")}>ボス画像を設定</button>:null}</div>:null}
          <textarea ref={titleInput} rows={1} className="visual-article-title" aria-label="記事タイトル" value={article.title} onChange={e=>onChange({title:e.target.value})} placeholder="記事タイトル"/>
        </div>
        {article.summary?<textarea className="visual-article-summary" aria-label="導入文（記事概要）" rows={3} value={article.summary} onChange={e=>onChange({summary:e.target.value})}/>:null}
        {article.coverImage?<ArticleMediaImage image={article.coverImage}/>:null}
        {article.sections.map((section,si)=><section className={"visual-section"+(section.eventActivity?" visual-campaign-section":"")+(section.questSection?" visual-quest-section":"")} id={"edit-"+section.id} key={section.id}>
          <div className={"visual-section-heading"+(section.hideHeading?" is-hidden-heading":"")}><input aria-label="セクション見出し" readOnly={!!section.questWave} title={section.questWave?"WAVE名と順序は共通項目で編集します":undefined} value={section.heading} onFocus={()=>{setTargetSectionId(section.id);setSelectedId(section.blocks[0]?.id??"");setEditor(null);}} onChange={e=>onChange({sections:article.sections.map((s,index)=>index===si?{...s,heading:e.target.value}:s)})}/>
            <details className="visual-section-menu"><summary aria-label="セクション操作">⋯</summary><div><button type="button" onClick={()=>moveSection(section.id,-1)} disabled={!!section.questWave||!article.sections.slice(0,si).some(s=>!!s.eventActivity===!!section.eventActivity)}>上へ移動</button><button type="button" onClick={()=>moveSection(section.id,1)} disabled={!!section.questWave||!article.sections.slice(si+1).some(s=>!!s.eventActivity===!!section.eventActivity)}>下へ移動</button><button type="button" aria-label="セクションを削除" disabled={!!section.questSection||!!section.questWave} title={section.questSection?"共通セクションは未入力なら記事から自動省略されます":""} onClick={()=>structure(article.sections.filter(s=>s.id!==section.id))}>{section.eventActivity?"施策と開催情報を削除":"セクションを削除"}</button></div></details></div>
          {section.eventActivity?<details className="visual-campaign-period"><summary>開催日時を編集 · {eventPeriodText(section.eventActivity.period)}</summary><EventPeriodFields period={section.eventActivity.period} onChange={period=>changePeriod(section.eventActivity!.id,period)} label={section.heading+"の期間"}/><small>この日時は記事表示とホームイベントで共通です。</small></details>:<label className="visual-section-visibility"><input type="checkbox" disabled={!!section.questSection||!!section.questWave} checked={section.questSection||section.questWave?true:!section.hideHeading} onChange={e=>onChange({sections:article.sections.map((s,index)=>index===si?{...s,hideHeading:!e.target.checked}:s)})}/>このセクションの見出しを公開記事に表示</label>}
          {section.questWave?<p className="quest-editor-structured">このWAVE専用の解説です。<button type="button" onClick={()=>onEditQuestData?.("phases")}>WAVE名・順序・関連情報を編集</button></p>:null}{section.questSection&&sourceArticle.quest?<div className="quest-editor-structured"><p className="muted">この下の解説はTiptapで編集できます。共通データは入力フォームと同じ情報を参照します。</p>{section.questSection!=="points"?<><button type="button" onClick={()=>onEditQuestData?.(section.questSection!)}>共通項目を編集</button><details><summary>共通項目の表示プレビュー</summary><QuestSectionData quest={sourceArticle.quest} sectionKey={section.questSection} characters={characters} preview/></details></>:null}</div>:null}
          {section.blocks.map((block,bi)=><div key={block.id} data-block-id={block.id} className={"visual-block"+(block.id===selectedId?" selected":"")+(block.type==="point"?" article-preview-point":block.type==="warning"?" article-preview-warning":"")}
            onClick={e=>{if(e.target instanceof Element&&e.target.closest("a"))e.preventDefault();setSelectedId(block.id);if(["image","characterCard"].includes(block.type))setEditor(null);}} onDragOver={e=>{if(dragId.current||e.dataTransfer.types.includes("Files"))e.preventDefault();}}
            onDrop={e=>{e.preventDefault();e.stopPropagation();if(dragId.current){move(dragId.current,si,bi);dragId.current="";}else if(e.dataTransfer.files[0])void upload(e.dataTransfer.files[0],block.id);}}>
            <div className="visual-block-tools" onClick={e=>e.stopPropagation()}>
              <button type="button" draggable onDragStart={e=>{dragId.current=block.id;e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("application/x-kotodaman-block",block.id);}} onDragEnd={()=>{dragId.current="";}} aria-label="ブロックをドラッグ">⋮⋮</button>
              <span>{labels[block.type]}</span>
              <details className="visual-block-menu"><summary aria-label="ブロック操作" onClick={()=>{setSelectedId(block.id);if(block.id!==selectedId)setEditor(null);}}>⋯</summary><div className="visual-block-menu-items" onClick={e=>e.currentTarget.closest("details")?.removeAttribute("open")}>
                <button type="button" onClick={()=>{setSelectedId(block.id);setSettingsOpen(true);}}>ブロックの設定</button>
                <button type="button" aria-label="ブロックを上へ" disabled={bi===0} onClick={()=>move(block.id,si,bi-1)}>↑ 上へ移動</button>
                <button type="button" aria-label="ブロックを下へ" disabled={bi===section.blocks.length-1} onClick={()=>move(block.id,si,bi+2)}>↓ 下へ移動</button>
                <button type="button" aria-label="ブロックを複製" onClick={()=>insert({...structuredClone(block),id:id()},block.id)}>複製</button>
                <button type="button" aria-label="ブロックを削除" onClick={()=>structure(article.sections.map(s=>({...s,blocks:s.blocks.filter(b=>b.id!==block.id)})))}>削除</button>
              </div></details>
            </div>
            <div className="visual-block-content" style={{paddingBlock:block.spacing??8,textAlign:block.align}}>
              {["image","characterCard"].includes(block.type)?<><button className="visual-select-block" type="button" onClick={()=>{setSelectedId(block.id);setEditor(null);setSettingsOpen(true);}}>このブロックを設定</button><ArticleBodyBlock block={{...block,spacing:0}} characters={characters}/>{block.image?<button className="visual-image-resize" type="button" aria-label="画像サイズをドラッグで変更" onPointerDown={e=>resize(e,block)}>↔</button>:null}</>:
                <>{block.type==="collapse"?<p className="visual-collapse-title">▾ {block.collapseTitle||"詳しく見る"}</p>:null}<RichBlockEditor block={block} onChange={patch=>patchBlock(block.id,patch)} onActive={next=>{setSelectedId(block.id);setEditor(next);}} onImage={file=>void upload(file,block.id)} onError={onError}/></>}
            </div>
          </div>)}
          {!section.blocks.length?<button type="button" onClick={()=>{const block={id:id(),type:"paragraph" as const,content:""};structure(article.sections.map(s=>s.id===section.id?{...s,blocks:[block]}:s));setSelectedId(block.id);}}>本文ブロックを追加</button>:null}
        </section>)}
        <button type="button" onClick={()=>{const block={id:id(),type:"paragraph" as const,content:""};structure([...article.sections,{id:id(),heading:"新しいセクション",blocks:[block]}]);setSelectedId(block.id);}}>＋ セクション追加</button>
        {sourceArticle.event?<button type="button" onClick={addActivity}>＋ 施策を追加</button>:null}
        <p className="muted visual-editor-help">本文をクリックして編集。Ctrl+B/I/Uで装飾、Ctrl+Zで取り消し。画像はドロップ・貼り付けでも挿入できます。</p>
      </div>
      {settingsOpen?<aside className="visual-editor-settings" id="article-editor-settings" aria-label="記事とブロックの設定">
        <details open><summary>選択ブロックの設定</summary>{selected?<div className="visual-settings-fields">
          <p>{labels[selected.type]}</p>
          <label>上下の余白<input aria-label="ブロック余白" type="number" min={0} max={96} value={selected.spacing??8} onChange={e=>patchBlock(selected.id,{spacing:Number(e.target.value)})}/></label>
          <label>ブロック配置<select value={selected.align??"left"} onChange={e=>patchBlock(selected.id,{align:e.target.value as ArticleBlock["align"]})}><option value="left">左</option><option value="center">中央</option><option value="right">右</option></select></label>
          {selected.image?<><ArticleImageWidthFields image={selected.image} onChange={image=>patchBlock(selected.id,{image})}/>
            <label>画像の配置<select aria-label="画像の配置" value={selected.image.align??"center"} onChange={e=>patchBlock(selected.id,{image:{...selected.image!,align:e.target.value as "left"|"center"|"right"}})}><option value="left">左</option><option value="center">中央</option><option value="right">右</option></select></label>
            <label>代替テキスト<input aria-label="画像の代替テキスト" value={selected.image.alt} onChange={e=>patchBlock(selected.id,{image:{...selected.image!,alt:e.target.value}})}/></label>
            <label>キャプション<input aria-label="画像キャプション" value={selected.image.caption??""} onChange={e=>patchBlock(selected.id,{image:{...selected.image!,caption:e.target.value}})}/></label>
            <label>画像リンク<input value={selected.image.href??""} onChange={e=>patchBlock(selected.id,{image:{...selected.image!,href:e.target.value||undefined}})}/></label>
            <button type="button" onClick={()=>uploadInput.current?.click()}>画像を追加</button></>:null}
          {selected.type==="characterCard"?<button type="button" onClick={()=>setPicker("cardReplace")}>キャラクターを変更</button>:null}
          {selected.type==="collapse"?<label>折りたたみの見出し<input value={selected.collapseTitle??""} onChange={e=>patchBlock(selected.id,{collapseTitle:e.target.value})}/></label>:null}
          {selected.richText&&selected.richText.content.length>1?<button type="button" onClick={()=>{const blocks=legacyBlockDocument(selected).content.map(n=>{const richText:RichTextDocument={type:"doc",content:[n]};return {...selected,id:id(),richText,content:richTextPlain(richText)};});structure(article.sections.map(s=>({...s,blocks:s.blocks.flatMap(b=>b.id===selected.id?blocks:[b])})));}}>段落を独立ブロックにする</button>:null}
        </div>:<p>本文・画像・カードを選択してください。</p>}</details>
        <details><summary>アイキャッチ画像</summary><label>画像をアップロード<input type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={e=>{if(e.target.files?.[0])void upload(e.target.files[0],selectedId,true);e.target.value="";}}/></label>{article.coverImage?<><ArticleImageWidthFields image={article.coverImage} onChange={coverImage=>onChange({coverImage})} label="アイキャッチ"/><label>アイキャッチの代替テキスト<input value={article.coverImage.alt} onChange={e=>onChange({coverImage:{...article.coverImage!,alt:e.target.value}})}/></label><button type="button" onClick={()=>onChange({coverImage:undefined})}>アイキャッチを外す</button></>:null}</details>
        {settings}
      </aside>:null}
    </div>
    {picker?<ArticleCharacterPicker characters={characters} initialQuery={picker==="link"&&active?active.state.doc.textBetween(active.state.selection.from,active.state.selection.to,""):""} onClose={()=>setPicker(null)} onChoose={c=>{
      if(picker==="link"&&active){const attrs={href:"/characters/"+encodeURIComponent(c.id),characterId:c.id};if(active.state.selection.empty)active.chain().focus().insertContent({type:"text",text:c.name,marks:[{type:"link",attrs}]}).run();else active.chain().focus().extendMarkRange("link").setMark("link",attrs).run();}
      else if(picker==="cardReplace"&&selected?.type==="characterCard")patchBlock(selected.id,{characterIds:[c.id]});else insert({id:id(),type:"characterCard",content:"",characterIds:[c.id]});
      setPicker(null);
    }}/>:null}
  </>;
}
