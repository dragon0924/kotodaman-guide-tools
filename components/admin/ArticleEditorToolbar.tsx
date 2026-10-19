"use client";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { safeRichUrl, safeTextColor, safeTextSize } from "@/lib/articleRichText";

type Props={editor:Editor|null;onCharacterLink:()=>void;onInsert:(kind:string)=>void;undoBlocks:()=>void;redoBlocks:()=>void;canUndoBlocks:boolean;canRedoBlocks:boolean;settingsOpen:boolean;onToggleSettings:()=>void;context?:ReactNode};
const colors=[["紺","#17304f"],["黒","#222222"],["赤","#d32632"],["青","#2368b2"],["緑","#287c4b"],["金","#a67619"],["紫","#8551a0"],["白","#ffffff"]];
const backgrounds=[["黄","#fff2a8"],["桃","#ffe1e5"],["青","#ddecff"],["緑","#dff3df"],["紫","#ece2fa"],["クリーム","#fff9eb"],["灰","#e8e8e8"],["白","#ffffff"]];
const closeMenu=(event:MouseEvent<HTMLElement>)=>event.currentTarget.closest("details")?.removeAttribute("open");
export function ArticleEditorToolbar({editor,onCharacterLink,onInsert,undoBlocks,redoBlocks,canUndoBlocks,canRedoBlocks,settingsOpen,onToggleSettings,context}:Props) {
  const toolbarRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const toolbar=toolbarRef.current;if(!toolbar)return;
    const root=document.documentElement,property="--article-toolbar-height",previous=root.style.getPropertyValue(property);
    const measure=()=>root.style.setProperty(property,Math.ceil(toolbar.getBoundingClientRect().height)+"px");
    measure();const observer=new ResizeObserver(measure);observer.observe(toolbar);
    return()=>{observer.disconnect();if(previous)root.style.setProperty(property,previous);else root.style.removeProperty(property);};
  },[]);
  const state=useEditorState({editor,selector:({editor})=>editor?{from:editor.state.selection.from,to:editor.state.selection.to,doc:editor.state.doc,stored:editor.state.storedMarks?.map(m=>({type:m.type.name,attrs:m.attrs})),color:editor.getAttributes("textStyle").color,background:editor.getAttributes("textStyle").backgroundColor??editor.getAttributes("highlight").color}:null});
  type ColorDraft={editor:Editor|null;from:number;to:number;value:string};
  const [linkOpen,setLinkOpen]=useState(false),[url,setUrl]=useState(""),[colorDraft,setColorDraft]=useState<ColorDraft|null>(null),[backgroundDraft,setBackgroundDraft]=useState<ColorDraft|null>(null),[message,setMessage]=useState("");
  const matching=(draft:ColorDraft|null)=>draft?.editor===editor&&draft?.from===state?.from&&draft?.to===state?.to;
  const color=matching(colorDraft)?colorDraft!.value:safeTextColor(state?.color)??"#17304f";
  const background=matching(backgroundDraft)?backgroundDraft!.value:safeTextColor(state?.background)??"#fff2a8";
  const fontSize=safeTextSize(editor?.getAttributes("textStyle").fontSize)??"16px";
  const sizes=[8,10,12,14,16,18,20,24,28,32,40,48,64,72,96];
  const draft=(value:string):ColorDraft=>({editor,from:editor?.state.selection.from??0,to:editor?.state.selection.to??0,value});
  const swatch=(value:string)=>{const valid=safeTextColor(value)??"#17304f";if(valid.startsWith("rgba"))return "#"+(valid.match(/\d+/gu)??[]).slice(0,3).map(n=>Number(n).toString(16).padStart(2,"0")).join("");return valid.length===4||valid.length===5?"#"+valid.slice(1,4).split("").map(ch=>ch+ch).join(""):valid.slice(0,7);};
  const button=(label:string,action:()=>void,active=false,enabled=true,title?:string)=> <button key={label} type="button" disabled={!editor||!enabled} aria-pressed={active} title={title??label} aria-label={title?.split(" Ctrl")[0]??label} onMouseDown={e=>e.preventDefault()} onClick={action}>{label}</button>;
  function applyColor(value:string,isBackground:boolean) {
    if(!editor)return;const valid=safeTextColor(value);if(!valid){setMessage("色は #ff0000 などのカラーコードで指定してください。");return;}
    if(isBackground){setBackgroundDraft(draft(valid));editor.chain().focus().setBackgroundColor(valid).run();}
    else {setColorDraft(draft(valid));editor.chain().focus().setColor(valid).run();}setMessage("");
  }
  function palette(isBackground:boolean) {
    const value=isBackground?background:color,label=isBackground?"背景色":"文字色";
    return <details name="article-editor-tool-menu" className="visual-toolbar-menu visual-color-menu"><summary aria-label={label+"を選ぶ"}><span className="visual-color-symbol" style={isBackground?{backgroundColor:swatch(value)}:{color:swatch(value),borderBottomColor:swatch(value)}}>{isBackground?"▰":"A"}</span>{label}<span aria-hidden>⌄</span></summary>
      <div className="visual-toolbar-menu-content"><strong>{label}</strong><div className="visual-color-palette">{(isBackground?backgrounds:colors).map(([name,hex])=><button key={hex} type="button" aria-label={label+"："+name} title={name+" "+hex} disabled={!editor} style={{backgroundColor:hex}} onMouseDown={e=>e.preventDefault()} onClick={()=>applyColor(hex,isBackground)}><span className="sr-only">{name}</span></button>)}</div>
      <label className="visual-color-custom">カスタム<input aria-label={isBackground?"文字背景色":"文字色"} type="color" disabled={!editor} value={swatch(value)} onChange={e=>applyColor(e.target.value,isBackground)}/><input aria-label={isBackground?"背景色コード":"文字色コード"} value={value} disabled={!editor} onChange={e=>isBackground?setBackgroundDraft(draft(e.target.value)):setColorDraft(draft(e.target.value))}/></label>
      {button(label+"を適用",()=>applyColor(value,isBackground))}
      {button(label+"を解除",()=>{if(isBackground){editor?.chain().focus().unsetBackgroundColor().unsetHighlight().run();setBackgroundDraft(null);}else {editor?.chain().focus().unsetColor().run();setColorDraft(null);}})}
      <button type="button" className="visual-menu-close" onMouseDown={e=>e.preventDefault()} onClick={closeMenu}>メニューを閉じる</button></div></details>;
  }
  function applyLink(){if(!editor)return;if(!safeRichUrl(url.trim())){setMessage("https:// またはサイト内のURLを指定してください。");return;}const current=editor.getAttributes("link");editor.chain().focus().extendMarkRange("link").setMark("link",{href:url.trim(),characterId:current.href===url.trim()?current.characterId??null:null}).run();setLinkOpen(false);setMessage("");}
  const insertOptions=[["paragraph","本文"],["h2","見出し H2"],["h3","見出し H3"],["h4","見出し H4"],["image","画像"],["characterCard","キャラカード"],["table","表"],["point","ポイント"],["warning","注意"],["collapse","折りたたみ"]];
  return <div ref={toolbarRef} className="visual-editor-toolbar" role="toolbar" aria-label="記事の編集ツール">
    <div className="visual-toolbar-row">
      <div className="visual-toolbar-group" role="group" aria-label="段落"><small>段落</small><div>
        <select aria-label="段落と見出し" disabled={!editor} value={editor?.isActive("heading")?String(editor.getAttributes("heading").level):"paragraph"} onChange={e=>{const chain=editor?.chain().focus();if(e.target.value==="paragraph")chain?.setParagraph().run();else chain?.setHeading({level:Number(e.target.value) as 2|3|4}).run();}}><option value="paragraph">本文</option><option value="2">見出し H2</option><option value="3">見出し H3</option><option value="4">見出し H4</option></select>
        {button("箇条書き",()=>{editor?.chain().focus().toggleBulletList().run();},editor?.isActive("bulletList"))}
        <details name="article-editor-tool-menu" className="visual-toolbar-menu"><summary>段落設定 ⌄</summary><div className="visual-toolbar-menu-content">
          {button("番号リスト",()=>{editor?.chain().focus().toggleOrderedList().run();},editor?.isActive("orderedList"))}
          {(["left","center","right"] as const).map((align,index)=>button(["左寄せ","中央","右寄せ"][index],()=>{editor?.chain().focus().setTextAlign(align).run();},editor?.isActive({textAlign:align})))}
          {button("引用",()=>{editor?.chain().focus().toggleBlockquote().run();},editor?.isActive("blockquote"))}{button("区切り線",()=>{editor?.chain().focus().setHorizontalRule().run();})}
        <button type="button" className="visual-menu-close" onMouseDown={e=>e.preventDefault()} onClick={closeMenu}>メニューを閉じる</button></div></details>
      </div></div>
      <div className="visual-toolbar-group" role="group" aria-label="文字装飾"><small>文字装飾</small><div>
        {button("太字",()=>{editor?.chain().focus().toggleBold().run();},editor?.isActive("bold"),true,"太字 Ctrl+B")}{button("下線",()=>{editor?.chain().focus().toggleUnderline().run();},editor?.isActive("underline"),true,"下線 Ctrl+U")}
        {palette(false)}{palette(true)}
        <details name="article-editor-tool-menu" className="visual-toolbar-menu"><summary>その他 ⌄</summary><div className="visual-toolbar-menu-content">
          {button("斜体",()=>{editor?.chain().focus().toggleItalic().run();},editor?.isActive("italic"),true,"斜体 Ctrl+I")}{button("取消線",()=>{editor?.chain().focus().toggleStrike().run();},editor?.isActive("strike"))}
          <label>文字サイズ<select aria-label="文字サイズ" disabled={!editor} value={fontSize} onChange={e=>editor?.chain().focus().setFontSize(e.target.value).run()}>{!sizes.some(n=>n+"px"===fontSize)?<option value={fontSize}>{fontSize}</option>:null}{sizes.map(n=><option key={n} value={n+"px"}>{n}px</option>)}</select></label>
          {button("マーカー",()=>{const valid=safeTextColor(background);if(valid)editor?.chain().focus().toggleHighlight({color:valid}).run();},editor?.isActive("highlight"))}{button("書式解除",()=>{editor?.chain().focus().unsetAllMarks().clearNodes().run();})}
        <button type="button" className="visual-menu-close" onMouseDown={e=>e.preventDefault()} onClick={closeMenu}>メニューを閉じる</button></div></details>
      </div></div>
      <div className="visual-toolbar-group" role="group" aria-label="挿入"><small>挿入</small><div>
        {button("リンク",()=>{setUrl(editor?.getAttributes("link").href??"");setLinkOpen(true);},editor?.isActive("link"))}
        <details name="article-editor-tool-menu" className="visual-toolbar-menu"><summary>＋ 挿入 ⌄</summary><div className="visual-toolbar-menu-content">
          {insertOptions.map(([kind,label])=><button key={kind} type="button" onClick={e=>{closeMenu(e);onInsert(kind);}}>{label+"を挿入"}</button>)}
          {button("キャラ名リンク",onCharacterLink)}{button("リンク解除",()=>{editor?.chain().focus().extendMarkRange("link").unsetLink().run();})}
        <button type="button" className="visual-menu-close" onMouseDown={e=>e.preventDefault()} onClick={closeMenu}>メニューを閉じる</button></div></details>
      </div></div>
      <div className="visual-toolbar-group" role="group" aria-label="操作履歴"><small>操作履歴</small><div>
        {button("↶",()=>{editor?.chain().focus().undo().run();},false,editor?.can().undo(), "取り消し Ctrl+Z")}{button("↷",()=>{editor?.chain().focus().redo().run();},false,editor?.can().redo(),"やり直し Ctrl+Shift+Z")}
        <details name="article-editor-tool-menu" className="visual-toolbar-menu"><summary>ブロック履歴 ⌄</summary><div className="visual-toolbar-menu-content"><button type="button" disabled={!canUndoBlocks} onClick={undoBlocks}>ブロック操作を取り消す</button><button type="button" disabled={!canRedoBlocks} onClick={redoBlocks}>ブロック操作をやり直す</button><button type="button" className="visual-menu-close" onMouseDown={e=>e.preventDefault()} onClick={closeMenu}>メニューを閉じる</button></div></details>
      </div></div>
    </div>
    {context}
    <div className="visual-toolbar-context"><small>{editor?"選択した文字・段落に書式を適用します。":"本文をクリックすると文字装飾を使えます。"}</small><button type="button" aria-expanded={settingsOpen} aria-controls="article-editor-settings" onClick={onToggleSettings}>{settingsOpen?"設定を閉じる":"設定を開く"}</button></div>
    {editor?.isActive("table")?<div className="visual-toolbar-row visual-table-tools" role="group" aria-label="表の操作"><small>表</small>
      {button("行を追加",()=>{editor.chain().focus().addRowAfter().run();})}{button("列を追加",()=>{editor.chain().focus().addColumnAfter().run();})}{button("行を削除",()=>{editor.chain().focus().deleteRow().run();})}{button("列を削除",()=>{editor.chain().focus().deleteColumn().run();})}{button("セル結合",()=>{editor.chain().focus().mergeCells().run();},false,editor.can().mergeCells())}{button("セル分割",()=>{editor.chain().focus().splitCell().run();},false,editor.can().splitCell())}{button("見出し行",()=>{editor.chain().focus().toggleHeaderRow().run();})}
    </div>:null}
    {linkOpen?<div className="visual-link-popover"><label>リンク先<input aria-label="リンク先URL" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https:// または /characters/…"/></label><button type="button" disabled={!editor} onClick={applyLink}>リンクを適用</button><button type="button" onClick={()=>setLinkOpen(false)}>閉じる</button></div>:null}
    {message?<p role="alert">{message}</p>:null}
  </div>;
}
