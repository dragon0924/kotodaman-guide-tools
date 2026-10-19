export const GUIDE_LINKS = [
  { id: "home", label: "ホーム", href: "/" },
  { id: "characters", label: "キャラ検索", href: "/characters" },
  { id: "articles", label: "イベント・攻略記事", href: "/articles" },
  { id: "team", label: "編成管理", href: "/team" },
  { id: "quests", label: "クエスト攻略", href: "/quests" },
  { id: "damage", label: "ダメージ計算", href: "/damage" },
  { id: "settings", label: "設定", href: "/settings" },
] as const;

const within = (pathname: string, base: string) => pathname === base || pathname.startsWith(base + "/");

export function guidePageLayout(pathname: string) {
  const path = pathname.replace(/\/+$/u, "") || "/";
  // Preview pages share the reading layout; the actual editor keeps a wider canvas.
  const homePreview = path === "/admin/home-preview";
  const articlePreview = path === "/admin/article-layout-preview";
  const editor = within(path, "/admin") && !homePreview && !articlePreview;
  const wide = editor || path === "/characters" || path === "/team";
  const active = homePreview ? "home" : articlePreview ? "articles"
    : within(path, "/admin") ? "admin"
    : GUIDE_LINKS.find(link => link.href === "/" ? path === "/" : within(path, link.href))?.id;
  return { active, variant: wide ? "wide" as const : "standard" as const, editor };
}
