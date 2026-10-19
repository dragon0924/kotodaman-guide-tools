import { articleEventStatus, eventPeriodStatus, eventPeriodText, isPublicArticle, validEventInstant } from "./articleEvents.ts";
import type { Article, ArticleEventPeriod } from "./types";

export type HomeEventCard = {
  articleId: string;
  name: string;
  summary: string;
  href: string;
  isDraft: boolean;
  imageUrl?: string;
  schedule: { period?: ArticleEventPeriod; activities: { name: string; period: ArticleEventPeriod }[] };
};

export function localEventImage(value?: string) {
  if (typeof value !== "string" || !value.startsWith("/images/") || /[?#\\]/u.test(value)) return undefined;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.includes("%") || /[?#\\]/u.test(decoded) || decoded.split("/").some(part => part === "." || part === "..") || !/\.(?:png|jpe?g|webp|avif|svg)$/iu.test(decoded)) return undefined;
    return value;
  } catch { return undefined; }
}

export function selectHomeEvents(articles: Article[], now = new Date(), options: { includeDrafts?: boolean; articleId?: string } = {}): HomeEventCard[] {
  return articles.filter(article => {
    if (!article.event || !article.event.name || options.articleId && article.id !== options.articleId) return false;
    if (!isPublicArticle(article) && !(options.includeDrafts === true && article.status === "draft")) return false;
    if (article.status === "published" && !article.slug) return false;
    return articleEventStatus(article.event, now) === "ongoing";
  }).map((article, index) => ({ article, index }))
    .sort((a, b) => {
      const order = (value?: number) => typeof value === "number" && Number.isFinite(value) ? value : 0;
      return order(a.article.event?.homeOrder) - order(b.article.event?.homeOrder) || a.index - b.index;
    }).map(({ article }) => {
      const event = article.event!;
      const isDraft = article.status === "draft";
      return {
        articleId: article.id,
        name: event.name,
        summary: article.summary ?? "",
        href: isDraft ? "/admin?tab=articles&article=" + encodeURIComponent(article.id) + "&preview=1" : "/articles/" + encodeURIComponent(article.slug ?? ""),
        isDraft,
        imageUrl: localEventImage(event.bannerImageUrl),
        schedule: { period: event.period, activities: event.activities.map(a => ({ name: a.name, period: a.period })) },
      };
    });
}

export function homeEventTiming(card: HomeEventCard, now = new Date()) {
  const period = card.schedule.period;
  if (period) return { periodText: eventPeriodText(period), deadlineAt: period.endAt && validEventInstant(period.endAt) ? period.endAt : undefined, deadlineLabel: "イベント終了", deadlineDetail: "" };
  const active = card.schedule.activities.filter(a => a.period.endAt && validEventInstant(a.period.endAt) && a.period.availability !== "permanent" && eventPeriodStatus(a.period, now) === "ongoing")
    .sort((a, b) => new Date(a.period.endAt!).getTime() - new Date(b.period.endAt!).getTime());
  const deadlineAt = active[0]?.period.endAt;
  const sameDeadline = active.filter(a => deadlineAt && new Date(a.period.endAt!).getTime() === new Date(deadlineAt).getTime());
  return {
    periodText: "施策ごとに開催期間が異なります",
    deadlineAt,
    deadlineLabel: "直近で終了する施策",
    deadlineDetail: sameDeadline.length ? sameDeadline[0].name + (sameDeadline.length > 1 ? " ほか" + (sameDeadline.length - 1) + "施策" : "") : "",
  };
}
