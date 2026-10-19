import { isPublicArticle, validDay } from "./articleEvents.ts";
import { safeArticleImageUrl } from "./articleRichText.ts";
import { selectHomeEvents, localEventImage } from "./homeEvents.ts";
import type { Article, CharacterRecord } from "./types";

export type SiteNavigationSettings={version:1;newCharacterIds:string[];recommendedArticleIds:string[];updatedAt?:string};
export type NavigationCharacter=Pick<CharacterRecord,"id"|"name"|"imageUrl"|"attribute"|"attributes"|"species"|"race"|"letters">;
export type NavigationArticle={id:string;title:string;href:string;imageSrc?:string;publishedOn?:string};
export type PublicSiteNavigation={characters:NavigationCharacter[];events:NavigationArticle[];recommended:NavigationArticle[];recent:NavigationArticle[]};
export const emptySiteNavigation=():SiteNavigationSettings=>({version:1,newCharacterIds:[],recommendedArticleIds:[]});
export function validateSiteNavigation(value:unknown,options:{characterIds?:Set<string>;articleIds?:Set<string>}={}):asserts value is SiteNavigationSettings {
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("表示設定の形式が不正です。");
  const v=value as SiteNavigationSettings;
  if(v.version!==1||Object.keys(v).some(k=>!["version","newCharacterIds","recommendedArticleIds","updatedAt"].includes(k)))throw new Error("未対応の表示設定です。");
  for(const [field,limit,validIds] of [["newCharacterIds",8,options.characterIds],["recommendedArticleIds",6,options.articleIds]] as const){
    const ids=v[field];
    if(!Array.isArray(ids)||ids.length>limit||ids.some(id=>typeof id!=="string"||!id.trim()||id.length>200)||new Set(ids).size!==ids.length)throw new Error(`${field}は重複のないIDを${limit}件以内で指定してください。`);
    if(validIds&&ids.some(id=>!validIds.has(id)))throw new Error(field==="newCharacterIds"?"未登録のキャラIDです。":"公開済みの記事から選択してください。");
  }
  if(v.updatedAt!==undefined&&(typeof v.updatedAt!=="string"||!Number.isFinite(Date.parse(v.updatedAt))))throw new Error("設定の更新日時が不正です。");
}
export function publicNavigationArticles(articles:Article[]){
  return articles.filter(a=>isPublicArticle(a)&&typeof a.slug==="string"&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(a.slug));
}
export function navigationArticle(article:Article):NavigationArticle {
  const imageSrc=safeArticleImageUrl(article.coverImage?.src)?article.coverImage!.src:localEventImage(article.event?.bannerImageUrl);
  return {id:article.id,title:article.title,href:"/articles/"+encodeURIComponent(article.slug!),...(imageSrc?{imageSrc}:{}),...(article.publishedOn&&validDay(article.publishedOn)?{publishedOn:article.publishedOn}:{})};
}
export function buildPublicSiteNavigation(settings:SiteNavigationSettings,characters:NavigationCharacter[],articles:Article[],now=new Date()):PublicSiteNavigation {
  const publicArticles=publicNavigationArticles(articles),byArticle=new Map(publicArticles.map(a=>[a.id,a]));
  const byCharacter=new Map(characters.map(c=>[c.id,c]));
  const selected=settings.newCharacterIds.flatMap(id=>{const c=byCharacter.get(id);return c?[{id:c.id,name:c.name,imageUrl:c.imageUrl,attribute:c.attribute,attributes:c.attributes,species:c.species,race:c.race,letters:c.letters}]:[];});
  const events=selectHomeEvents(publicArticles,now).slice(0,3).flatMap(e=>{const a=byArticle.get(e.articleId);return a?[navigationArticle(a)]:[];});
  const used=new Set(events.map(a=>a.id));
  const recommended=settings.recommendedArticleIds.flatMap(id=>{const a=byArticle.get(id);if(!a||used.has(id))return [];used.add(id);return [navigationArticle(a)];});
  // Unknown publication dates follow dated articles, preserving file order. Editing never makes an article "new".
  const recent=publicArticles.map((article,index)=>({article,index})).filter(({article})=>!used.has(article.id)).sort((a,b)=>(validDay(b.article.publishedOn??"")?b.article.publishedOn!:"").localeCompare(validDay(a.article.publishedOn??"")?a.article.publishedOn!:"")||a.index-b.index).slice(0,5).map(({article})=>navigationArticle(article));
  return {characters:selected,events,recommended,recent};
}
