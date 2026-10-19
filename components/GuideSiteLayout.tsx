"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { GUIDE_LINKS, guidePageLayout } from "@/lib/guideNavigation";
import type { PublicSiteNavigation } from "@/lib/siteNavigation";
import { GuideLeftSidebar, GuideRightSidebar } from "./GuideSidebars";
import { GuideMobileMenu } from "./GuideMobileMenu";
import { WorkspaceDeckProvider } from "./WorkspaceDeckProvider";

export function GuideSiteLayout({ children, initialData }: { children: ReactNode; initialData: PublicSiteNavigation }) {
  const pathname = usePathname();
  const { active, variant, editor } = guidePageLayout(pathname);
  const [data, setData] = useState(initialData);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      if (document.hidden) return;
      try {
        const response = await fetch("/api/site-navigation", { cache: "no-store", signal: controller.signal });
        if (response.ok && !controller.signal.aborted) setData(await response.json() as PublicSiteNavigation);
      } catch { /* Keep the last public snapshot during temporary connection failures. */ }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("kotodaman-site-navigation-saved", refresh);
    return () => {
      controller.abort(); window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("kotodaman-site-navigation-saved", refresh);
    };
  }, [pathname]);
  const hasRight = variant === "standard" && !!(data.recommended.length || data.recent.length);
  return <WorkspaceDeckProvider><div className={`guide-site guide-site-${variant}${editor ? " guide-site-editor" : ""}`}>
    <a className="guide-skip-link" href="#guide-main">本文へ移動</a>
    <header className="guide-header">
      <div className="guide-header-inner">
        <Link href="/" className="guide-brand"><strong>コトダマン攻略支援</strong><span>キャラを探す。ことばで攻略する。</span></Link>
        <GuideMobileMenu><GuideLeftSidebar data={data}/></GuideMobileMenu>
      </div>
      <nav className="guide-primary-nav" aria-label="主要機能">
        {GUIDE_LINKS.map(link => <Link key={link.id} href={link.href} aria-current={active === link.id ? "page" : undefined}>{link.label}</Link>)}
      </nav>
    </header>
    <div className={"guide-columns" + (hasRight ? " has-right" : "")}>
      <aside className="guide-left" aria-label="最新情報・攻略メニュー"><GuideLeftSidebar data={data}/></aside>
      <main className="guide-main" id="guide-main" tabIndex={-1}>{children}</main>
      {hasRight ? <aside className="guide-right" aria-label="おすすめ・新着記事"><GuideRightSidebar data={data}/></aside> : null}
    </div>
    <footer className="guide-footer"><strong>コトダマン攻略支援</strong><Link href="/characters">キャラ検索</Link><Link href="/articles">イベント・攻略記事</Link></footer>
  </div></WorkspaceDeckProvider>;
}
