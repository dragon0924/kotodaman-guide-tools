import { NextRequest } from "next/server";
import { articleMediaStorage, isArticleAdmin } from "@/lib/server/articleMedia";
import { articleMediaResponse } from "@/lib/server/articleMediaResponse";
import { articleImageSources } from "@/lib/articleRichText";
import { readArticles } from "@/lib/articleStore";
import { isPublicArticle } from "@/lib/articleEvents";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  return articleMediaResponse(request,id,{admin:isArticleAdmin(request),storage:articleMediaStorage,isPublic:async()=> (await readArticles()).articles.some(a=>isPublicArticle(a)&&articleImageSources(a).includes("/api/article-media/"+id))});
}
