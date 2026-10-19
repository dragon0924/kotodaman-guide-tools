import type { Metadata } from "next";
import Home from "@/app/page";
import { HomeEventPreviewProvider } from "@/components/HomeEventArea";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ホーム表示プレビュー", robots: { index: false, follow: false } };
export default async function HomePreviewPage({ searchParams }: { searchParams: Promise<{ article?: string | string[] }> }) {
  const params = await searchParams;
  const articleId = typeof params.article === "string" ? params.article : undefined;
  // This page sends no article data in HTML/RSC. The existing admin credential gates the preview API.
  return <HomeEventPreviewProvider articleId={articleId}><Home /></HomeEventPreviewProvider>;
}
