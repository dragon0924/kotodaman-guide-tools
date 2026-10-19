"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ArticleContent,type ArticleCharacterLink} from "@/components/ArticleContent";
import {ArticleMediaAuthContext} from "@/components/ArticleMediaImage";
import type {Article} from "@/lib/types";

export function AdminArticleLayoutPreview({articleId}:{articleId:string}){
  const router=useRouter();
  const [value,setValue]=useState<{article:Article;articles:Article[];characters:ArticleCharacterLink[];secret:string}>(),[error,setError]=useState("");
  useEffect(()=>{
    const abort=new AbortController();
    const load=async()=>{
      const secret=sessionStorage.getItem("kotodaman-admin-password")??"";
      const response=await fetch("/api/admin/articles",{headers:{"x-admin-password":secret},cache:"no-store",signal:abort.signal});
      if(!response.ok)throw new Error(response.status===401?"管理画面にログインしてからプレビューを開いてください。":"記事を読み込めませんでした。");
      const data=await response.json() as {articles:Article[];characterOptions:ArticleCharacterLink[]},article=data.articles.find(a=>a.id===articleId);
      if(!article)throw new Error("記事が見つかりません。");
      if(!abort.signal.aborted)setValue({article,articles:data.articles,characters:data.characterOptions,secret});
    };
    void load().catch(e=>{if(!abort.signal.aborted)setError(e instanceof Error?e.message:"プレビューを読み込めませんでした。");});
    return()=>abort.abort();
  },[articleId]);
  return <><div className="home-event-preview-note"><strong>管理者用・保存済み記事のレイアウト確認</strong><p>本文は読み取り専用です。この記事の公開状態は変更しません。</p><Link href={"/admin?tab=articles&article="+encodeURIComponent(articleId)}>記事エディターに戻る</Link></div>
    {error?<p role="alert">{error} <Link href="/admin?tab=articles">管理画面へ</Link></p>:value?<ArticleMediaAuthContext.Provider value={value.secret}><ArticleContent article={value.article} characters={value.characters} relatedArticles={value.articles.map(a=>({id:a.id,title:a.title,href:"/admin/article-layout-preview?article="+encodeURIComponent(a.id)}))} preview previewLabel={value.article.status==="published"?"管理者プレビュー（保存済みの公開記事）":value.article.status==="archived"?"管理者プレビュー（保管・非公開）":undefined} initialNow={new Date().toISOString()} onEditQuestSection={(key,target,waveId,waveTarget)=>router.push("/admin?tab=articles&article="+encodeURIComponent(value.article.id)+"&questSection="+key+"&questTarget="+target+(waveId?"&questWave="+encodeURIComponent(waveId)+"&waveTarget="+(waveTarget??"points"):""))}/></ArticleMediaAuthContext.Provider>:<p role="status">認証と記事を確認しています…</p>}
  </>;
}
