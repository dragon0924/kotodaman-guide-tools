"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { articleEventStatus } from "@/lib/articleEvents";
import type { HomeEventCard } from "@/lib/homeEvents";
import { HomeEventBanner } from "./HomeEventBanner";
import { ArticleMediaAuthContext } from "./ArticleMediaImage";

const PreviewContext = createContext<{ articleId?: string } | null>(null);
export function HomeEventPreviewProvider({ articleId, children }: { articleId?: string; children: ReactNode }) {
  const value = useMemo(() => ({ articleId }), [articleId]);
  return <PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>;
}

export function HomeEventArea() {
  const preview = useContext(PreviewContext);
  const [events, setEvents] = useState<HomeEventCard[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "unauthorized" | "error">("loading");
  const [now, setNow] = useState(() => Date.now());
  const [mediaSecret,setMediaSecret]=useState<string>();
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function refresh() {
      try {
        const secret = preview ? window.sessionStorage.getItem("kotodaman-admin-password")?.trim() : undefined;
        setMediaSecret(secret);
        const url = preview ? "/api/admin/home-events" + (preview.articleId ? "?article=" + encodeURIComponent(preview.articleId) : "") : "/api/events/home";
        const response = await fetch(url, { cache: "no-store", signal: controller.signal, headers: secret ? { "x-admin-password": secret } : {} });
        if (cancelled) return;
        if (response.status === 401) { setEvents([]); setStatus("unauthorized"); return; }
        if (!response.ok) { setEvents([]); setStatus("error"); return; }
        const data = await response.json() as { events: HomeEventCard[] };
        if (!cancelled) { setEvents(data.events); setStatus("ready"); }
      } catch { if (!cancelled) { setEvents([]); setStatus("error"); } }
    }
    void refresh();
    const poll = window.setInterval(() => void refresh(), 30000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { cancelled = true; controller.abort(); window.clearInterval(poll); window.clearInterval(clock); };
  }, [preview]);
  const active = events.filter(event => articleEventStatus(event.schedule, new Date(now)) === "ongoing");
  if (preview && status === "unauthorized") return <aside className="home-event-preview-note"><strong>ホーム表示プレビュー</strong><p>管理画面にログイン後、この画面を再読み込みしてください。</p><Link href="/admin?tab=articles">管理画面でログイン</Link></aside>;
  if (!active.length) return preview ? <aside className="home-event-preview-note"><strong>ホーム表示プレビュー</strong><p>{status === "loading" ? "開催情報を確認しています。" : status === "error" ? "開催情報を読み込めませんでした。" : "開催中のイベント記事はありません。"}</p></aside> : null;
  return <section className="home-current-events" aria-label="開催中イベント">
    {preview ? <p className="home-event-preview-note">ホーム表示プレビュー（管理者限定）</p> : null}
    <ArticleMediaAuthContext.Provider value={mediaSecret}>{active.map(event => <HomeEventBanner key={event.articleId} event={event} now={new Date(now)} />)}</ArticleMediaAuthContext.Provider>
  </section>;
}
