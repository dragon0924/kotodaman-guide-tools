"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { PublicSiteNavigation } from "@/lib/siteNavigation";
import { GuideSiteLayout } from "../GuideSiteLayout";
import { WorkspaceDeckProvider } from "../WorkspaceDeckProvider";

function AdminLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  // Reload between management tabs so their initial query selection and the editor's
  // existing beforeunload protection both run, including when a draft is unsaved.
  return <Link href={href} className={className} prefetch={false} onNavigate={event => {
    event.preventDefault(); window.location.assign(href);
  }}>{children}</Link>;
}

export function AdminShell({ children, navigation }: { children: ReactNode; navigation: PublicSiteNavigation }) {
  const pathname = usePathname();
  const preview = pathname === "/admin/article-layout-preview" || pathname === "/admin/home-preview";
  return <div className={"admin-shell" + (preview ? "" : " guide-site-editor")} data-admin-surface="local">
    <header className="admin-shell-header">
      <AdminLink href="/admin" className="admin-shell-brand">コトダマン攻略支援 <strong>ローカル管理</strong></AdminLink>
      <p>記事編集・データ管理専用。下書きの保存だけでは一般公開されません。</p>
      <nav aria-label="管理者専用ナビゲーション">
        <AdminLink href="/admin?tab=articles">記事編集</AdminLink><AdminLink href="/admin?tab=characters">キャラ管理</AdminLink>
        <AdminLink href="/admin?tab=settings">表示設定</AdminLink><AdminLink href="/admin/logs">確認ログ</AdminLink>
        <Link href="/" target="_blank" rel="noopener noreferrer">一般サイトを確認 ↗</Link>
      </nav>
    </header>
    {preview ? <GuideSiteLayout initialData={navigation}>{children}</GuideSiteLayout>
      : <WorkspaceDeckProvider><main className="admin-shell-main" id="admin-main">{children}</main></WorkspaceDeckProvider>}
  </div>;
}
