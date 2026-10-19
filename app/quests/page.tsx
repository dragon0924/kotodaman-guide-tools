import Link from "next/link";
import { ArticleShell } from "@/components/ArticleShell";
import { readArticles } from "@/lib/articleStore";
import { isPublicArticle } from "@/lib/articleEvents";
export const dynamic = "force-dynamic";
export default async function QuestsPage() {
  const articles = (await readArticles()).articles.filter(a => a.type === "quest_guide" && isPublicArticle(a));
  return <ArticleShell><h1>クエスト攻略</h1><p>ボス・ギミック・盤面などを確認できる攻略記事です。</p><div className="article-list">{articles.length ? articles.map(a => <Link className="event-activity-card" key={a.id} href={"/articles/" + a.slug}><h2>{a.title}</h2>{a.quest && <p>{[a.quest.boss, a.quest.difficulty].filter(Boolean).join(" ／ ")}</p>}{a.summary && <p>{a.summary}</p>}</Link>) : <p>公開済みのクエスト攻略記事はまだありません。</p>}</div></ArticleShell>;
}
