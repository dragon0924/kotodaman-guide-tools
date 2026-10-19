"use client";
import Image from "next/image";
import Link from "next/link";
import { createElement, type CSSProperties, type ReactNode } from "react";
import { sanitizeRichDocument } from "@/lib/articleRichText";
import type { Article, ArticleBlock, RichTextNode } from "@/lib/types";
import type { ArticleCharacterLink } from "./ArticleContent";
import { ArticleMediaImage } from "./ArticleMediaImage";

export function CharacterArticleCard({character}:{character:ArticleCharacterLink}) {
  const attributes=character.attributes?.length?character.attributes.join("・"):character.attribute;
  return <Link className="article-character-card" href={"/characters/"+encodeURIComponent(character.id)}>
    {character.imageUrl?<Image src={character.imageUrl} alt="" width={80} height={80} sizes="80px" loading="lazy" />:<span className="article-character-placeholder">キャラ</span>}
    <span><strong>{character.name}</strong><small>{attributes} / {character.species??character.race??"種族未取得"}</small><small>{character.letters?.join("・")}</small></span>
  </Link>;
}
function headingId(prefix:string,path:number[]){return prefix+"-heading-"+path.join("-");}
export function richHeadings(block:ArticleBlock) {
  const headings:Array<{id:string;label:string}>=[];
  const text=(n:RichTextNode):string=>n.text??n.content?.map(text).join("")??"";
  const walk=(n:RichTextNode,path:number[])=>{if(n.type==="heading")headings.push({id:headingId(block.id,path),label:text(n)});n.content?.forEach((child,index)=>walk(child,[...path,index]));};
  block.richText?.content.forEach((n,index)=>walk(n,[index]));return headings;
}
export function RichTextView({document,prefix}:{document:unknown;prefix:string}) {
  let clean;
  try {clean=sanitizeRichDocument(document);}catch{return <p className="status error">本文の形式を確認してください。</p>;}
  const render=(n:RichTextNode,path:number[]):ReactNode=>{
    const key=path.join("-"),a=n.attrs??{};
    const children=n.content?.map((child,index)=>render(child,[...path,index]));
    const style:CSSProperties={...(a.textAlign?{textAlign:a.textAlign as CSSProperties["textAlign"]}:{})};
    if(n.type==="text") {
      let value:ReactNode=n.text;
      for(const mark of n.marks??[]) {
        const m=mark.attrs??{};
        if(mark.type==="link")value=<a key={key+"link"} href={String(m.href)} data-character-id={m.characterId as string|undefined} rel="noopener noreferrer" target={String(m.href).startsWith("/")||String(m.href).startsWith("#")?undefined:"_blank"}>{value}</a>;
        else if(mark.type==="textStyle")value=<span style={{color:m.color as string|undefined,backgroundColor:m.backgroundColor as string|undefined,fontSize:m.fontSize as string|undefined}}>{value}</span>;
        else if(mark.type==="highlight")value=<mark style={{backgroundColor:m.color as string|undefined}}>{value}</mark>;
        else value=createElement(({bold:"strong",italic:"em",underline:"u",strike:"s",code:"code"} as Record<string,string>)[mark.type],null,value);
      }
      return <span key={key}>{value}</span>;
    }
    if(n.type==="hardBreak")return <br key={key}/>;
    if(n.type==="horizontalRule")return <hr key={key}/>;
    if(n.type==="heading")return createElement("h"+a.level,{key,id:headingId(prefix,path),style},children);
    if(n.type==="paragraph")return <p key={key} style={style}>{children?.length?children:<br/>}</p>;
    if(n.type==="bulletList")return <ul key={key}>{children}</ul>;
    if(n.type==="orderedList")return <ol key={key} start={a.start as number|undefined}>{children}</ol>;
    if(n.type==="listItem")return <li key={key}>{children}</li>;
    if(n.type==="blockquote")return <blockquote key={key}>{children}</blockquote>;
    if(n.type==="codeBlock")return <pre key={key}><code>{children}</code></pre>;
    if(n.type==="table")return <div key={key} className="article-table-scroll"><table><tbody>{children}</tbody></table></div>;
    if(n.type==="tableRow")return <tr key={key}>{children}</tr>;
    if(n.type==="tableCell"||n.type==="tableHeader")return createElement(n.type==="tableHeader"?"th":"td",{key,colSpan:a.colspan,rowSpan:a.rowspan,style:{width:Array.isArray(a.colwidth)?a.colwidth.reduce((sum:number,w:number)=>sum+w,0):undefined}},children);
    return null;
  };
  return <div className="article-rich-content">{clean.content.map((n,i)=>render(n,[i]))}</div>;
}
export function ArticleBodyBlock({block,characters}:{block:ArticleBlock;characters:ArticleCharacterLink[]}) {
  let content:ReactNode;
  if(block.type==="image")content=block.image?<ArticleMediaImage image={block.image} zoomable/>:null;
  else if(block.type==="characterCard")content=<div className="article-character-grid">{block.characterIds?.map((id,index)=>{const c=characters.find(c=>c.id===id);return c?<CharacterArticleCard key={id+"-"+index} character={c}/>:<p key={id+"-"+index}>キャラ情報を確認できません</p>;})}</div>;
  else content=block.richText?<RichTextView document={block.richText} prefix={block.id}/>:<div className="article-rich-content"><p className={block.content?"":"article-preview-empty"}>{block.content||"（未入力）"}</p></div>;
  if(block.type==="collapse")content=<details className="article-collapse"><summary>{block.collapseTitle||"詳しく見る"}</summary>{content}</details>;
  return <div className={"article-preview-block"+(block.type==="point"?" article-preview-point":block.type==="warning"?" article-preview-warning":"")} style={{marginBlock:block.spacing,textAlign:block.align}}>
    {block.type==="point"?<strong>ポイント</strong>:block.type==="warning"?<strong>注意</strong>:null}{content}
  </div>;
}
export function RichArticleSections({article,characters}:{article:Article;characters:ArticleCharacterLink[]}) {
  return <>
    {article.toc?<nav className="article-toc" aria-label="目次"><strong>目次</strong><ul>{article.sections.flatMap(section=>[...(!section.hideHeading?[{id:"section-"+section.id,label:section.heading}]:[]),...section.blocks.flatMap(richHeadings)]).map(h=><li key={h.id}><a href={"#"+encodeURIComponent(h.id)}>{h.label}</a></li>)}</ul></nav>:null}
    {article.sections.map(section=><section key={section.id}>{!section.hideHeading?<h2 id={"section-"+section.id}>{section.heading}</h2>:null}{section.blocks.map(block=><ArticleBodyBlock key={block.id} block={block} characters={characters}/>)}</section>)}
  </>;
}
