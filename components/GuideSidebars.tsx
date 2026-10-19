import Link from "next/link";
import {ArticleMediaImage} from "./ArticleMediaImage";
import type {NavigationArticle,PublicSiteNavigation} from "@/lib/siteNavigation";

function ArticleLinks({title,articles,event=false}:{title:string;articles:NavigationArticle[];event?:boolean}){
  if(!articles.length)return null;
  return <section className="guide-sidebar-section"><h2>{title}</h2><ul className="guide-article-links">{articles.map(a=><li key={a.id}><Link href={a.href} className="guide-article-link">
    {a.imageSrc?<div className="guide-article-thumb"><ArticleMediaImage image={{src:a.imageSrc,alt:""}}/></div>:null}
    <span>{event?<small className="guide-ongoing">開催中</small>:null}<strong>{a.title}</strong>{a.publishedOn?<time dateTime={a.publishedOn}>{a.publishedOn.replaceAll("-","/")}</time>:null}</span>
  </Link></li>)}</ul></section>;
}
export function GuideLeftSidebar({data}:{data:PublicSiteNavigation}){
  return <>
    <ArticleLinks title="開催中のイベント" articles={data.events} event/>
    {data.characters.length?<section className="guide-sidebar-section"><h2>新登場キャラクター</h2><ul className="guide-character-links">{data.characters.map(c=><li key={c.id}><Link href={"/characters/"+encodeURIComponent(c.id)} className="guide-character-link">
      {c.imageUrl?<img src={c.imageUrl} alt="" loading="lazy" width={52} height={52} referrerPolicy="no-referrer"/>:<span className="guide-character-placeholder" aria-hidden>{c.name.slice(0,1)}</span>}
      <span><strong>{c.name}</strong><small>{(c.attributes?.length?c.attributes:[c.attribute]).join("・")} / {c.species??c.race??"種族未取得"}</small></span>
    </Link></li>)}</ul></section>:null}
    <section className="guide-sidebar-section"><h2>キャラクター・攻略</h2><nav className="guide-quick-links" aria-label="攻略メニュー"><Link href="/characters">キャラクター検索 <span aria-hidden>→</span></Link><Link href="/articles">イベント・攻略記事 <span aria-hidden>→</span></Link><Link href="/quests">クエスト攻略 <span aria-hidden>→</span></Link><Link href="/team">編成管理 <span aria-hidden>→</span></Link></nav></section>
  </>;
}
export function GuideRightSidebar({data}:{data:PublicSiteNavigation}){
  return <><ArticleLinks title="おすすめ記事" articles={data.recommended}/><ArticleLinks title="新着記事" articles={data.recent}/></>;
}
