import { isAdminRequest } from "@/lib/server/adminAuth";
import { NextRequest, NextResponse } from "next/server";
import { readArticles } from "@/lib/articleStore";
import { selectHomeEvents } from "@/lib/homeEvents";

export const dynamic = "force-dynamic";
const headers = { "cache-control": "private, no-store", vary: "x-admin-password" };
export async function GET(request: NextRequest) {
  // Use the same server-side credential and header as the existing article admin API.
  if (!isAdminRequest(request)) return new NextResponse("Unauthorized", { status: 401, headers });
  try {
    const now = new Date();
    const events = selectHomeEvents((await readArticles()).articles, now, { includeDrafts: true, articleId: request.nextUrl.searchParams.get("article") || undefined });
    return NextResponse.json({ events, checkedAt: now.toISOString() }, { headers });
  } catch {
    return NextResponse.json({ error: "開催情報を読み込めませんでした。" }, { status: 500, headers });
  }
}
