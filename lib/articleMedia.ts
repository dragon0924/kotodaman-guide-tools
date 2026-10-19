/** Originals and storage keys are never public URLs. */
export const MEDIA_WIDTHS = [160, 320, 640, 960, 1440, 1920] as const;
export const MEDIA_PURPOSES = ["article", "screenshot", "banner", "thumbnail", "icon"] as const;
export type MediaPurpose = typeof MEDIA_PURPOSES[number];
export const MEDIA_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(?:webp|png|jpg)$/u;
export function articleMediaWidth(renderedWidth: number, dpr = 1) {
  const desired = Math.max(1, renderedWidth) * Math.min(2, Math.max(1, dpr));
  return MEDIA_WIDTHS.find(w => w >= desired) ?? 1920;
}
