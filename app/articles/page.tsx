import Link from "next/link";
import { ArticleShell } from "@/components/ArticleShell";
import { readArticles } from "@/lib/articleStore";
import { isPublicArticle } from "@/lib/articleEvents";
export const dynamic = "force-dynamic";
export default async function ArticlesPage() {
  const articles=(await readArticles()).articles.filter(isPublicArticle);
  return <ArticleShell><h1>イベント・攻略記事</h1><div className="article-list">{articles.length?articles.map(article=><Link className="event-activity-card" key={article.id} href={"/articles/"+article.slug}><h2>{article.title}</h2><p>{article.summary}</p></Link>):<p>公開済みの記事はまだありません。</p>}</div></ArticleShell>;
}
