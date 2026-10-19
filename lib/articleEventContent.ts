import type { Article, ArticleBlock, ArticleEventActivity, ArticleSection } from "./types";
import { richTextPlain } from "./articleRichText.ts";

// This marker exists only in the editing view. The saved source of a campaign is event.activities.
export type EventEditorSection = ArticleSection & { eventActivity?: ArticleEventActivity };
export function activitySectionId(id: string) { return "event-activity-" + encodeURIComponent(id); }
export function activityBodyBlocks(activity: ArticleEventActivity): ArticleBlock[] {
  return activity.blocks ?? [{ id: activitySectionId(activity.id) + "-body", type: "paragraph", content: activity.summary }];
}
export function activityEditorSection(activity: ArticleEventActivity): EventEditorSection {
  return { id: activitySectionId(activity.id), heading: activity.name, blocks: activityBodyBlocks(activity), eventActivity: activity };
}
export function eventEditorView(article: Article): Omit<Article,"sections"> & { sections: EventEditorSection[] } {
  if (!article.event) return article;
  return { ...article, sections: [...article.sections.slice(0, 1), ...article.event.activities.map(activityEditorSection), ...article.sections.slice(1)] };
}
export function applyEventEditorPatch(article: Article, patch: Partial<Article>): Partial<Article> {
  if (!article.event || !patch.sections) return patch;
  const view = patch.sections as EventEditorSection[];
  const activities = view.filter(s => s.eventActivity).map(section => {
    const base = article.event!.activities.find(a => a.id === section.eventActivity!.id) ?? section.eventActivity!;
    const bodyChanged = JSON.stringify(section.blocks) !== JSON.stringify(activityBodyBlocks(base));
    return { ...base, name: section.heading, ...(bodyChanged ? {
      blocks: section.blocks,
      // Keep the legacy plain-text field synchronized; it is no longer a separate editing surface.
      summary: section.blocks.map(b => b.richText ? richTextPlain(b.richText) : b.content).filter(Boolean).join("\n\n"),
    } : {}) };
  });
  return { ...patch, sections: view.filter(s => !s.eventActivity), event: { ...article.event, activities, publicationReviewed: false } };
}
export function eventArticleToc(article: Article) {
  return [
    ...(article.event?.activities.map(a => ({ id: activitySectionId(a.id), label: a.name })) ?? []),
    ...article.sections.slice(1).filter(s => !s.hideHeading).map(s => ({ id: "section-" + s.id, label: s.heading })),
  ];
}
export function eventArticleSources(article: Article) {
  return [...new Set([...(article.event?.officialUrls ?? []), ...(article.event?.activities.map(a => a.officialUrl) ?? [])].filter(Boolean))];
}
