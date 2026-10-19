import { NextResponse } from "next/server";
import { readArticles } from "@/lib/articleStore";
import { selectHomeEvents } from "@/lib/homeEvents";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const now = new Date();
    const events = selectHomeEvents((await readArticles()).articles, now);
    return NextResponse.json({ events, checkedAt: now.toISOString() }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "開催情報を読み込めませんでした。" }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
