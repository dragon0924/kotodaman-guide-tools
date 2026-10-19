import test from "node:test";
import assert from "node:assert/strict";
import { articleEventStatus } from "../lib/articleEvents.ts";
import { homeEventTiming, localEventImage, selectHomeEvents } from "../lib/homeEvents.ts";
import type { Article } from "../lib/types";

const now = new Date("2026-10-13T12:00:00+09:00");
const fixture = (id = "event"): Article => ({
  id, title: "記事のタイトル", type: "event_summary", slug: id, status: "published", summary: "管理画面で編集した紹介文",
  sections: [{ id: "body", heading: "非対象", blocks: [{ id: "text", type: "paragraph", content: "SECTION_PRIVATE_MARKER" }] }],
  createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z",
  event: { name: "別のイベント", activities: [{ id: "gacha", name: "召喚", kind: "gacha", period: { startAt: "2026-10-10T12:00+09:00", endAt: "2026-10-20T03:59+09:00" }, summary: "ACTIVITY_BODY_MARKER", characterIds: [], officialUrl: "https://example.com/source" }], officialUrls: ["https://example.com/source"], lastCheckedOn: "2026-10-13", publicationReviewed: true, history: [{ checkedOn: "2026-10-13", note: "HISTORY_PRIVATE_MARKER" }] },
});

test("general home contains only reviewed published ongoing events and omits zero results", () => {
  const live = fixture(), draft = { ...fixture("draft"), status: "draft" as const }, archived = { ...fixture("archive"), status: "archived" as const };
  const unreviewed = fixture("unchecked"); unreviewed.event!.publicationReviewed = false;
  const future = fixture("future"); future.event!.activities[0].period.startAt = "2026-10-15T12:00+09:00";
  const ended = fixture("ended"); ended.event!.activities[0].period.endAt = "2026-10-12T23:59+09:00";
  const regular = { ...fixture("regular"), type: "quest_guide" as const, event: undefined };
  assert.deepEqual(selectHomeEvents([draft, archived, unreviewed, future, ended, regular, live], now).map(c => c.articleId), [live.id]);
  assert.deepEqual(selectHomeEvents([draft, future, ended], now), []); assert.deepEqual(selectHomeEvents([], now), []);
});
test("admin selection targets an exact article ID and links drafts to the existing authenticated preview", () => {
  const a = { ...fixture("one"), status: "draft" as const }, b = { ...fixture("two"), status: "draft" as const };
  const cards = selectHomeEvents([a, b], now, { includeDrafts: true, articleId: "two" });
  assert.equal(cards.length, 1); assert.equal(cards[0].name, b.event!.name);
  assert.equal(cards[0].href, "/admin?tab=articles&article=two&preview=1"); assert.equal(cards[0].isDraft, true);
  assert.deepEqual(selectHomeEvents([a, b], now, { articleId: "two" }), []);
  assert.deepEqual(selectHomeEvents([a, b], now, { includeDrafts: true, articleId: "missing" }), []);
});
test("banner DTO exposes the selected article summary and periods without copying article or activity bodies", () => {
  const a = fixture(), before = structuredClone(a), card = selectHomeEvents([a], now)[0];
  assert.equal(card.summary, a.summary); assert.equal(card.href, "/articles/event");
  for (const secret of ["SECTION_PRIVATE_MARKER", "ACTIVITY_BODY_MARKER", "HISTORY_PRIVATE_MARKER"]) assert.ok(!JSON.stringify(card).includes(secret));
  homeEventTiming(card, now); assert.deepEqual(a, before);
});
test("the nearest active deadline is labeled as a campaign deadline rather than an invented overall end", () => {
  const a = fixture(); a.event!.activities.push({ ...a.event!.activities[0], id: "exchange", name: "交換所", kind: "exchange", period: { startAt: "2026-10-10T12:00+09:00", endAt: "2026-10-24T03:59+09:00" } });
  const card = selectHomeEvents([a], now)[0], first = homeEventTiming(card, now);
  assert.equal(first.deadlineAt, "2026-10-20T03:59+09:00"); assert.equal(first.deadlineLabel, "直近で終了する施策"); assert.equal(first.deadlineDetail, "召喚"); assert.equal(first.periodText, "施策ごとに開催期間が異なります");
  const afterGacha = new Date("2026-10-20T03:59+09:00"); assert.equal(articleEventStatus(card.schedule, afterGacha), "ongoing");
  assert.equal(homeEventTiming(card, afterGacha).deadlineAt, "2026-10-24T03:59+09:00");
  assert.equal(homeEventTiming(card, afterGacha).deadlineDetail, "交換所");
});
test("explicit event periods control inclusion independently of a longer exchange period", () => {
  const a = fixture(); a.event!.period = { startAt: "2026-10-10T12:00+09:00", endAt: "2026-10-18T11:59+09:00" };
  const card = selectHomeEvents([a], now)[0]; assert.equal(homeEventTiming(card, now).deadlineLabel, "イベント終了");
  assert.equal(homeEventTiming(card, now).deadlineAt, a.event!.period.endAt);
  assert.deepEqual(selectHomeEvents([a], new Date("2026-10-18T11:59+09:00")), []);
});
test("client schedule expiry and date-only starts use the shared JST status without changing stored data", () => {
  const a = fixture(), card = selectHomeEvents([a], now)[0], before = structuredClone(a);
  assert.equal(articleEventStatus(card.schedule, new Date("2026-10-20T03:58:59.999+09:00")), "ongoing");
  assert.equal(articleEventStatus(card.schedule, new Date("2026-10-20T03:59:00+09:00")), "ended"); assert.deepEqual(a, before);
  a.event!.period = { startDate: "2026-10-09", startNote: "メンテナンス後（時刻未公表）", endAt: "2026-12-01T11:59+09:00" };
  assert.deepEqual(selectHomeEvents([a], new Date("2026-10-09T12:00+09:00")), []);
  const nextDay = selectHomeEvents([a], new Date("2026-10-10T00:00+09:00"))[0];
  assert.ok(homeEventTiming(nextDay).periodText.includes("時刻未公表")); assert.ok(!homeEventTiming(nextDay).periodText.includes("00:00"));
});
test("optional order is stable and only explicitly registered local images are reused", () => {
  const a = fixture("one"), b = fixture("two"), c = fixture("three"); b.event!.homeOrder = -1; b.event!.bannerImageUrl = "/images/events/banner.webp";
  const before = structuredClone([a, b, c]); const cards = selectHomeEvents([a, b, c], now);
  assert.deepEqual(cards.map(card => card.articleId), ["two", "one", "three"]); assert.equal(cards[0].imageUrl, b.event!.bannerImageUrl); assert.equal(cards[1].imageUrl, undefined); assert.deepEqual([a, b, c], before);
  for (const value of ["https://example.com/banner.jpg", "//example.com/banner.jpg", "/images/../private.png", "/images/%2e%2e/private.png", "/images/events/%5cprivate.png", "data:image/png,x"]) assert.equal(localEventImage(value), undefined);
  assert.equal(localEventImage(42 as unknown as string), undefined);
});
test("equal deadlines with different ISO precision are grouped and schedule-only descents are not false ongoing events", () => {
  const a = fixture(); a.event!.activities.push({ ...a.event!.activities[0], id: "second", name: "報酬", period: { startAt: "2026-10-10T12:00+09:00", endAt: "2026-10-20T03:59:00+09:00" } });
  assert.equal(homeEventTiming(selectHomeEvents([a], now)[0], now).deadlineDetail, "召喚 ほか1施策");
  a.event!.activities = [{ ...a.event!.activities[0], period: { startAt: "2026-10-10T12:00+09:00", availability: "schedule" } }]; assert.deepEqual(selectHomeEvents([a], now), []);
});
