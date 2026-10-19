"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import type { CSSProperties } from "react";
import { formatEventInstant } from "@/lib/articleEvents";
import { homeEventTiming, type HomeEventCard } from "@/lib/homeEvents";
import { ArticleMediaImage } from "./ArticleMediaImage";

export function HomeEventBanner({ event, now }: { event: HomeEventCard; now: Date }) {
  const timing = homeEventTiming(event, now);
  const campaignDeadline = !event.schedule.period && Boolean(timing.deadlineAt);
  return <article className="home-current-event">
    <div className="home-event-visual" aria-hidden="true">
      {event.imageUrl ? event.imageUrl.startsWith("/api/article-media/") ? <ArticleMediaImage image={{src:event.imageUrl,alt:""}}/> : <Image src={event.imageUrl} alt="" fill sizes="(max-width: 720px) 100vw, 45vw" className="home-event-banner-image" /> : <>
        <div className="home-event-bloom">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ "--petal-turn": `${i * 45}deg` } as CSSProperties} />)}</div>
        <span className="home-event-visual-caption">CURRENT EVENT</span>
        <strong className="home-event-visual-name">{event.name}</strong>
        <span className="home-event-visual-rule" />
      </>}
    </div>
    <div className="home-event-content">
      <div className="home-event-badges"><span className="home-event-live-badge"><span />開催中</span>{event.isDraft ? <span className="home-event-draft-badge">管理者プレビュー・未公開</span> : null}</div>
      <p className="home-event-eyebrow">開催中イベント</p>
      <h3>{event.name}</h3>
      {event.summary ? <p className="home-event-summary">{event.summary}</p> : null}
      <div className="home-event-deadline">
        <CalendarDays size={20} aria-hidden />
        <div><span>{timing.deadlineAt ? timing.deadlineLabel : "終了日時未確認"}</span>
          {timing.deadlineDetail ? <strong className="home-event-deadline-name">{timing.deadlineDetail}</strong> : null}
          {timing.deadlineAt ? <time dateTime={timing.deadlineAt}>{campaignDeadline ? <small>終了 </small> : null}{formatEventInstant(timing.deadlineAt)} <small>日本時間</small></time> : null}
          <p>{campaignDeadline ? "イベント全体の終了日時ではありません" : timing.periodText}</p>
        </div>
      </div>
      <Link className="home-event-cta" href={event.href}>イベント攻略まとめを見る<ArrowRight size={20} aria-hidden /></Link>
    </div>
  </article>;
}
