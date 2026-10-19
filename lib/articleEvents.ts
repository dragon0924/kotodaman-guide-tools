import type { Article, ArticleEvent, ArticleEventActivity, ArticleEventPeriod } from "./types";
import { isQuestPublicationReady } from "./questArticle.ts";

export type EventPeriodStatus = "ongoing" | "upcoming" | "ended" | "schedule" | "unknown";
export const EVENT_STATUS_LABELS: Record<EventPeriodStatus, string> = { ongoing: "開催中", upcoming: "開催予定", ended: "終了", schedule: "出現スケジュール確認", unknown: "日時確認中" };
export const EVENT_KIND_LABELS = { gacha: "ガチャ", reward: "報酬", quest: "クエスト", exchange: "交換所", campaign: "キャンペーン" };
export const jstDate = (now: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now);
export function validDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value;
}
export function validEventInstant(value: string) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?\+09:00$/u);
  return !!match && validDay(match[1]) && Number(match[2]) < 24 && Number(match[3]) < 60 && Number(match[4] ?? 0) < 60;
}
export function jstInputToInstant(value: string) {
  if (!value) return undefined;
  const instant = value + "+09:00";
  if (!validEventInstant(instant)) throw new Error("開催日時は日本時間の正しい日付・時刻で入力してください。");
  return instant;
}
export function instantToJstInput(value?: string) {
  if (!value || !validEventInstant(value)) return "";
  return value.slice(0,16);
}
export function formatEventInstant(value?: string) {
  if (!value || !validEventInstant(value)) return "未確認";
  return new Intl.DateTimeFormat("ja-JP", {timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(value));
}
export function eventPeriodStatus(period: ArticleEventPeriod, now = new Date()): EventPeriodStatus {
  if (period.endAt && validEventInstant(period.endAt) && now.getTime() >= new Date(period.endAt).getTime()) return "ended";
  if (period.startAt && validEventInstant(period.startAt)) {
    if (now.getTime() < new Date(period.startAt).getTime()) return "upcoming";
    return period.availability === "schedule" ? "schedule" : "ongoing";
  }
  if (period.startDate && validDay(period.startDate)) {
    const today = jstDate(now);
    if (today < period.startDate) return "upcoming";
    if (today === period.startDate) return "unknown"; // A maintenance completion time was not published.
    return period.availability === "schedule" ? "schedule" : "ongoing";
  }
  return "unknown";
}
export function articleEventStatus(event: Pick<ArticleEvent, "period"> & { activities: Pick<ArticleEventActivity, "period">[] }, now = new Date()): EventPeriodStatus {
  if (event.period) return eventPeriodStatus(event.period, now);
  const limited = event.activities.filter(a => a.period.endAt && a.period.availability !== "permanent").map(a => eventPeriodStatus(a.period, now));
  if (!limited.length) return "unknown";
  if (limited.includes("ongoing")) return "ongoing";
  if (limited.includes("upcoming")) return "upcoming";
  return limited.every(s => s === "ended") ? "ended" : "unknown";
}
export function eventPeriodText(period: ArticleEventPeriod) {
  const start = period.startAt ? formatEventInstant(period.startAt) : period.startDate ? period.startDate.replaceAll("-","/") : "開始日時未確認";
  const end = period.availability === "permanent" ? "常設" : period.endAt ? formatEventInstant(period.endAt) : "終了日時未確認";
  return start + (period.startNote ? " " + period.startNote : "") + " ～ " + end + (period.endNote ? " " + period.endNote : "") + "（日本時間）";
}
export function isSafeArticleUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}
export function isPublicArticle(article: Article) {
  return article.status === "published" && article.contentReviewed !== false && isQuestPublicationReady(article) && ((!article.event && article.type !== "event_summary") || article.event?.publicationReviewed === true);
}
export function assertEventArticle(article: Article, characterIds?: Set<string>) {
  if (article.type !== "event_summary" && !article.event) return;
  const event = article.event;
  if (!event || typeof event.name !== "string" || !event.name.trim() || typeof event.lastCheckedOn !== "string" || typeof event.publicationReviewed !== "boolean" || !Array.isArray(event.activities) || !Array.isArray(event.officialUrls) || !Array.isArray(event.history)) throw new Error("イベント情報の形式が不正です。");
  if (event.officialUrls.some(url => typeof url !== "string") || event.history.some(h => !h || typeof h.checkedOn !== "string" || !validDay(h.checkedOn) || typeof h.note !== "string")) throw new Error("公式情報・更新履歴の形式が不正です。");
  if (event.lastCheckedOn && !validDay(event.lastCheckedOn)) throw new Error("最終確認日が不正です。");
  for (const url of [...event.officialUrls, ...event.activities.map(a => a.officialUrl)].filter(Boolean)) if (!isSafeArticleUrl(url)) throw new Error("公式情報URLはHTTPSのURLを入力してください。");
  const ids = new Set<string>();
  for (const activity of event.activities) {
    if (!activity || typeof activity.id !== "string" || !activity.id || ids.has(activity.id) || typeof activity.name !== "string" || !activity.name.trim() || typeof activity.summary !== "string" || typeof activity.officialUrl !== "string" || !Object.hasOwn(EVENT_KIND_LABELS,activity.kind) || !Array.isArray(activity.characterIds) || activity.characterIds.some(id => typeof id !== "string")) throw new Error("イベント施策の形式またはIDが不正です。");
    ids.add(activity.id);
    if (characterIds && activity.characterIds.some(id => !characterIds.has(id))) throw new Error("関連キャラに未登録のキャラクターが含まれています。");
  }
  for (const period of [...(event.period ? [event.period] : []), ...event.activities.map(a => a.period)]) {
    if (!period || typeof period !== "object" || [period.startAt,period.endAt,period.startDate,period.startNote,period.endNote,period.availability].some(v => v !== undefined && typeof v !== "string")) throw new Error("開催期間の形式が不正です。");
    if (!period || period.startAt && !validEventInstant(period.startAt) || period.endAt && !validEventInstant(period.endAt) || period.startDate && !validDay(period.startDate)) throw new Error("開催期間は日本時間で正しく入力してください。");
    if (period.startAt && period.endAt && new Date(period.endAt).getTime() <= new Date(period.startAt).getTime()) throw new Error("終了日時は開始日時より後にしてください。");
    if (period.startDate && period.endAt && period.endAt.slice(0,10) < period.startDate) throw new Error("終了日は開始日以降にしてください。");
    if (period.availability && !["limited","permanent","schedule"].includes(period.availability)) throw new Error("開催期間の区分が不正です。");
    if (period.availability === "permanent" && period.endAt) throw new Error("常設の期間に終了日時は設定できません。");
  }
  if (article.status === "published" && (!event.publicationReviewed || !event.lastCheckedOn || !event.officialUrls.length || !article.slug)) throw new Error("公開前に本文・期間・キャラリンクを確認し、最終確認日・公式情報URL・URL名を登録してください。");
}
