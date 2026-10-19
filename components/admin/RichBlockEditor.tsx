"use client";
import { useEffect } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, Color, BackgroundColor, FontSize } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TableKit } from "@tiptap/extension-table";
import { legacyBlockDocument, richTextPlain, safeRichUrl, sanitizeRichDocument } from "@/lib/articleRichText";
import type { ArticleBlock } from "@/lib/types";

const CharacterReferences=Extension.create({name:"characterReferences",addGlobalAttributes(){return [{types:["link"],attributes:{characterId:{default:null,parseHTML:element=>element.getAttribute("data-character-id"),renderHTML:attributes=>attributes.characterId?{"data-character-id":attributes.characterId}:{}}}}];}});
export function RichBlockEditor({block,onChange,onActive,onImage,onError}:{block:ArticleBlock;onChange:(patch:Partial<ArticleBlock>)=>void;onActive:(editor:Editor)=>void;onImage:(file:File)=>void;onError:(message:string)=>void}) {
  const editor=useEditor({
    immediatelyRender:false,
    extensions:[StarterKit.configure({heading:{levels:[2,3,4]},link:{openOnClick:false,autolink:false,isAllowedUri:url=>safeRichUrl(url)}}),CharacterReferences,TextStyle,Color,BackgroundColor,FontSize,Highlight.configure({multicolor:true}),TextAlign.configure({types:["heading","paragraph"],alignments:["left","center","right"]}),TableKit.configure({table:{resizable:true}})],
    content:legacyBlockDocument(block),
    editorProps:{
      attributes:{role:"textbox","aria-label":"ブロック本文","aria-multiline":"true",class:"article-rich-content"},
      handlePaste:(_view,event)=>{const file=Array.from(event.clipboardData?.files??[]).find(file=>file.type.startsWith("image/"));if(file){event.preventDefault();onImage(file);return true;}return false;},
      handleDrop:(_view,event)=>{const file=Array.from(event.dataTransfer?.files??[]).find(file=>file.type.startsWith("image/"));if(file){event.preventDefault();event.stopPropagation();onImage(file);return true;}return false;},
    },
    onFocus:({editor})=>onActive(editor),
    onSelectionUpdate:({editor})=>onActive(editor),
    onUpdate:({editor})=>{
      try {const richText=sanitizeRichDocument(editor.getJSON());onChange({richText,content:richTextPlain(richText)});}
      catch(error){onError(error instanceof Error?error.message:"本文の形式を確認してください。");}
    },
  },[block.id]);
  useEffect(()=>{
    if(!editor)return;
    const next=legacyBlockDocument(block);
    try {if(JSON.stringify(sanitizeRichDocument(editor.getJSON()))!==JSON.stringify(next))editor.commands.setContent(next,{emitUpdate:false});}catch{editor.commands.setContent(next,{emitUpdate:false});}
  },[editor,block.richText,block.content,block]);
  return <EditorContent editor={editor}/>;
}
