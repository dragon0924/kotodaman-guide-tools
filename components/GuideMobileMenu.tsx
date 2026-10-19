"use client";
import {useEffect,useRef,type ReactNode} from "react";

export function GuideMobileMenu({children}:{children:ReactNode}){
  const dialog=useRef<HTMLDialogElement>(null),opener=useRef<HTMLButtonElement>(null),overflow=useRef("");
  useEffect(()=>{
    const node=dialog.current!,wide=window.matchMedia("(min-width: 900px)");
    const close=()=>{document.body.style.overflow=overflow.current;opener.current?.focus();};
    const resize=()=>{if(wide.matches&&node.open)node.close();};
    // Close before the editor's document-level unsaved-change guard opens its warning.
    const follow=(event:MouseEvent)=>{if(node.open&&event.target instanceof Element&&node.contains(event.target)&&event.target.closest("a"))node.close();};
    node.addEventListener("close",close);wide.addEventListener("change",resize);
    window.addEventListener("click",follow,true);
    return()=>{if(node.open)document.body.style.overflow=overflow.current;node.removeEventListener("close",close);wide.removeEventListener("change",resize);window.removeEventListener("click",follow,true);};
  },[]);
  return <div className="guide-mobile-menu"><button ref={opener} type="button" aria-haspopup="dialog" onClick={()=>{overflow.current=document.body.style.overflow;dialog.current?.showModal();document.body.style.overflow="hidden";}}>☰ 攻略メニュー</button>
    <dialog ref={dialog} className="guide-menu-dialog" aria-label="攻略メニュー" onClick={e=>{if(e.target===e.currentTarget)e.currentTarget.close();}}>
      <div className="guide-menu-heading"><strong>攻略メニュー</strong><button type="button" onClick={()=>dialog.current?.close()} autoFocus>閉じる ×</button></div>
      <div className="guide-menu-content" onClick={e=>{if(e.target instanceof Element&&e.target.closest("a"))dialog.current?.close();}}>{children}</div>
    </dialog>
  </div>;
}
