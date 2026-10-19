"use client";
import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { safeArticleImageUrl, safeRichUrl } from "@/lib/articleRichText";
import { articleMediaWidth, MEDIA_WIDTHS } from "@/lib/articleMedia";
import type { ArticleImage } from "@/lib/types";
export const ArticleMediaAuthContext=createContext<string|undefined>(undefined);
export function ArticleMediaImage({image,zoomable=false,fallback}:{image:ArticleImage;zoomable?:boolean;fallback?:ReactNode}) {
  const secret=useContext(ArticleMediaAuthContext), privateMedia=image.src.startsWith("/api/article-media/");
  const key=image.src+"|"+(secret??"");
  const [viewport,setViewport]=useState({visible:false,width:0});
  const [loaded,setLoaded]=useState<{key:string;url:string}|null>(null),[zoom,setZoom]=useState<{key:string;url:string}|null>(null);
  const [failed,setFailed]=useState<string>(),[zoomError,setZoomError]=useState(false),[open,setOpen]=useState(false);
  const [actualSize,setActualSize]=useState(false);
  const figure=useRef<HTMLElement>(null),dialog=useRef<HTMLDialogElement>(null),zoomTrigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const node=figure.current;if(!node)return;
    const size=()=>setViewport(v=>({...v,width:Math.ceil(node.getBoundingClientRect().width)}));size();
    const resize=new ResizeObserver(size);resize.observe(node);
    const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setViewport(v=>({...v,visible:true}));observer.disconnect();}},{rootMargin:"200px 0px"});observer.observe(node);
    return()=>{observer.disconnect();resize.disconnect();};
  },[]);
  const width=articleMediaWidth(viewport.width,typeof window!=="undefined"?window.devicePixelRatio:1);
  const requestKey=key+"|"+width;
  const ready=viewport.visible&&viewport.width>0;
  useEffect(()=>{
    if(!privateMedia||!secret||!ready)return;
    let url:string|undefined,cancelled=false;const abort=new AbortController();
    void fetch(image.src+"?w="+width,{headers:{"x-admin-password":secret},cache:"no-store",signal:abort.signal}).then(async r=>{
      if(!r.ok)throw new Error("Image unavailable");const bytes=await r.blob();if(cancelled)return;
      url=URL.createObjectURL(bytes);setLoaded({key:requestKey,url});setFailed(undefined);
    }).catch(()=>{if(!cancelled)setFailed(key);});
    return()=>{cancelled=true;abort.abort();if(url)URL.revokeObjectURL(url);};
  },[image.src,secret,privateMedia,key,requestKey,ready,width]);
  useEffect(()=>{
    if(!open||!privateMedia||!secret)return;
    let url:string|undefined,cancelled=false;const abort=new AbortController();
    void fetch(image.src,{headers:{"x-admin-password":secret},cache:"no-store",signal:abort.signal}).then(async r=>{
      if(!r.ok)throw new Error("Image unavailable");const bytes=await r.blob();if(cancelled)return;
      url=URL.createObjectURL(bytes);setZoom({key,url});
    }).catch(()=>{if(!cancelled)setZoomError(true);});
    return()=>{cancelled=true;abort.abort();if(url)URL.revokeObjectURL(url);};
  },[open,image.src,secret,privateMedia,key]);
  if(!safeArticleImageUrl(image.src))return null;
  const source=failed!==key&&viewport.visible&&viewport.width?(privateMedia&&secret?loaded?.key===requestKey?loaded.url:undefined:privateMedia?image.src+"?w="+width:image.src):undefined;
  const candidates=privateMedia&&!secret&&image.width?[...MEDIA_WIDTHS.filter(w=>w<image.width!),image.width].map(w=>(MEDIA_WIDTHS.includes(w as typeof MEDIA_WIDTHS[number])?image.src+"?w="+w:image.src)+" "+w+"w").join(", "):undefined;
  const content=source?<img key={key} src={source} srcSet={candidates} sizes={viewport.width+"px"} width={image.width} height={image.height} alt={image.alt} loading="lazy" decoding="async" onError={()=>setFailed(key)}/>:fallback!==undefined?fallback:<span className="article-image-placeholder" style={image.width&&image.height?{aspectRatio:image.width+" / "+image.height}:undefined}>{failed===key?"画像を読み込めませんでした":"画像を読み込んでいます"}</span>;
  const styles={"--article-image-desktop-width":(image.widthPercent??100)+"%","--article-image-mobile-width":(image.mobileWidthPercent??image.widthPercent??100)+"%"} as CSSProperties;
  const zoomSource=privateMedia&&secret?zoom?.key===key?zoom.url:undefined:image.src;
  const imageLink=image.href&&safeRichUrl(image.href)?image.href:undefined;
  function openZoom() {
    setZoomError(false);setActualSize(false);setZoom(null);setOpen(true);
    const node=dialog.current;
    if(node){node.scrollTop=0;node.scrollLeft=0;node.showModal();}
  }
  return <figure ref={figure} className={"article-image article-image-"+(image.align??"center")} style={styles}>
    {zoomable?<button ref={zoomTrigger} className="article-image-trigger" type="button" disabled={!source} onClick={openZoom} aria-label={"画像を拡大："+(image.alt||image.caption||"記事画像")} aria-haspopup="dialog" aria-expanded={open} title="クリック・タップで拡大">{content}</button>:imageLink?<a href={imageLink} target={imageLink.startsWith("/")?undefined:"_blank"} rel="noopener noreferrer">{content}</a>:content}
    {zoomable?<>
      <dialog className="quest-image-dialog" ref={dialog} aria-label="画像の拡大表示" onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close();}} onClose={()=>{setOpen(false);setZoom(null);zoomTrigger.current?.focus({preventScroll:true});}}>
        <div className="quest-image-dialog-tools"><button type="button" onClick={()=>dialog.current?.close()} autoFocus>閉じる</button><button type="button" aria-pressed={actualSize} onClick={()=>setActualSize(v=>!v)}>{actualSize?"画面幅に合わせる":"原寸で細部を見る"}</button></div>
        {imageLink?<p><a href={imageLink} target={imageLink.startsWith("/")?undefined:"_blank"} rel="noopener noreferrer">画像のリンク先を開く</a></p>:null}
        {open?(zoomSource?<a href={zoomSource} target="_blank" rel="noopener noreferrer" title="元の大きさで開く"><img style={{width:actualSize?(image.width??"auto"):"100%",maxWidth:actualSize?"none":"100%"}} src={zoomSource} width={image.width} height={image.height} alt={image.alt}/></a>:<p>{zoomError?"拡大画像を読み込めませんでした":"高画質画像を読み込んでいます"}</p>):null}
        {actualSize?<p>縦・横にスクロールして細部を確認できます。</p>:null}{image.caption?<p>{image.caption}</p>:null}
      </dialog>
    </>:null}
    {image.caption?<figcaption>{image.caption}</figcaption>:null}
  </figure>;
}
