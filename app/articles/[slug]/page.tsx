import { notFound } from "next/navigation";
import { ArticleShell } from "@/components/ArticleShell";
import { ArticleContent } from "@/components/ArticleContent";
import { readArticles } from "@/lib/articleStore";
import { isPublicArticle } from "@/lib/articleEvents";
import { searchCharacterCache } from "@/lib/characterStore";
import { articleCharacterIds } from "@/lib/articleRichText";
export const dynamic = "force-dynamic";
export default async function ArticlePage({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;
  const all=(await readArticles()).articles;
  const article=all.find(a=>a.slug===slug&&isPublicArticle(a));
  if(!article)notFound();
  const ids=new Set(articleCharacterIds(article));
  const characters=ids.size?(await searchCharacterCache("",5000)).results.filter(c=>ids.has(c.id)).map(c=>({id:c.id,name:c.name,imageUrl:c.imageUrl,attribute:c.attribute,attributes:c.attributes,race:c.race,species:c.species,letters:c.letters})):[];
  const relatedArticles=article.quest?all.filter(isPublicArticle).map(a=>({id:a.id,title:a.title,href:"/articles/"+a.slug})):[];
  return <ArticleShell><ArticleContent article={article} characters={characters} relatedArticles={relatedArticles} initialNow={new Date().toISOString()}/></ArticleShell>;
}
