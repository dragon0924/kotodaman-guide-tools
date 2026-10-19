"use client";

import { Database, FileText, Lock, Map, Search, Settings, Sparkles, Star, Users } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AdminArticlesPanel } from "@/components/admin/AdminArticlesPanel";
import { AdminCharacterDetailCandidatesPanel } from "@/components/admin/AdminCharacterDetailCandidatesPanel";
import { AdminCharactersPanel } from "@/components/admin/AdminCharactersPanel";
import { AdminGroupsPanel } from "@/components/admin/AdminGroupsPanel";
import { AdminQuestsPanel } from "@/components/admin/AdminQuestsPanel";
import { AdminSpecialRarityPanel } from "@/components/admin/AdminSpecialRarityPanel";
import { AdminTraitsPanel } from "@/components/admin/AdminTraitsPanel";
import { AdminSiteNavigationPanel } from "@/components/admin/AdminSiteNavigationPanel";

type AdminTab =
  | "characters"
  | "groups"
  | "traits"
  | "quests"
  | "articles"
  | "detailCandidates"
  | "rarity"
  | "data"
  | "settings";

const ADMIN_TABS: Array<{
  id: AdminTab;
  label: string;
  icon: typeof Users;
}> = [
  { id: "characters", label: "キャラ管理", icon: Users },
  { id: "groups", label: "グループ管理", icon: Search },
  { id: "traits", label: "特性テンプレート", icon: Sparkles },
  { id: "quests", label: "クエスト管理", icon: Map },
  { id: "articles", label: "記事管理", icon: FileText },
  { id: "detailCandidates", label: "詳細候補", icon: Database },
  { id: "rarity", label: "特別レアリティ", icon: Star },
  { id: "data", label: "データ確認", icon: Database },
  { id: "settings", label: "設定", icon: Settings },
];

function tabFromHashOrQuery() {
  if (typeof window === "undefined") {
    return "characters" as AdminTab;
  }
  const params = new URLSearchParams(window.location.search);
  const queryTab = params.get("tab") as AdminTab | null;
  if (queryTab && ADMIN_TABS.some((tab) => tab.id === queryTab)) {
    return queryTab;
  }
  const hashTab = window.location.hash.replace("#", "") as AdminTab;
  if (hashTab && ADMIN_TABS.some((tab) => tab.id === hashTab)) {
    return hashTab;
  }
  return "characters";
}

export default function AdminPage() {
  const [password, setPassword] = useState(() =>
    typeof window === "undefined" ? "" : (window.sessionStorage.getItem("kotodaman-admin-password") ?? ""),
  );
  const [adminPassword, setAdminPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("characters");
  const [error, setError] = useState("");

  const activeLabel = useMemo(
    () => ADMIN_TABS.find((tab) => tab.id === activeTab)?.label ?? "管理画面",
    [activeTab],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setActiveTab(tabFromHashOrQuery());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const savedPassword = window.sessionStorage.getItem("kotodaman-admin-password")?.trim();
    if (!savedPassword || isAuthenticated) {
      return;
    }
    void verify(savedPassword, { silent: true });
  }, [isAuthenticated]);

  async function verify(secret: string, options?: { silent?: boolean }) {
    const normalizedSecret = secret.trim();
    if (!normalizedSecret) {
      setIsAuthenticated(false);
      setError("管理パスワードを入力してください。");
      return;
    }
    if (!options?.silent) {
      setError("");
    }

    const response = await fetch("/api/admin/characters", {
      headers: {
        "x-admin-password": normalizedSecret,
      },
    });
    if (!response.ok) {
      setIsAuthenticated(false);
      window.sessionStorage.removeItem("kotodaman-admin-password");
      if (!options?.silent) {
        setError(response.status === 401 ? "認証に失敗しました。.env.local の ADMIN_PASSWORD を確認してください。" : await response.text());
      }
      return;
    }

    setIsAuthenticated(true);
    setAdminPassword(normalizedSecret);
    window.sessionStorage.setItem("kotodaman-admin-password", normalizedSecret);
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    await verify(password);
  }

  function changeTab(tab: AdminTab) {
    const proceed = () => {
      setActiveTab(tab);
      window.history.replaceState(null, "", `/admin?tab=${tab}`);
    };
    if (window.dispatchEvent(new CustomEvent("kotodaman-before-admin-tab-change", { cancelable: true, detail: { proceed } }))) proceed();
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-page admin-login-page">
        <section className="admin-panel login-panel">
          <Lock size={34} aria-hidden />
          <h1>管理ログイン</h1>
          <p className="muted">`.env.local` の `ADMIN_PASSWORD` を入力してください。</p>
          <form className="admin-login-form" onSubmit={login}>
            <input
              autoFocus
              onChange={(event) => setPassword(event.target.value)}
              placeholder="ADMIN_PASSWORD"
              type="password"
              value={password}
            />
            <button className="primary" type="submit">ログイン</button>
          </form>
          {error ? <p className="status error">{error}</p> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="admin-page admin-dashboard">
      <header className="admin-hero">
        <div>
          <p className="eyebrow">ローカル管理</p>
          <h1>管理画面</h1>
          <p>キャラ情報、グループ、特性テンプレート、クエスト、攻略記事をまとめて管理します。</p>
        </div>
        <span className="tag muted-tag">{activeLabel}</span>
      </header>

      <nav className="admin-tabs" aria-label="管理メニュー">
        {ADMIN_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              className={activeTab === tab.id ? "active" : ""}
              key={tab.id}
              onClick={() => changeTab(tab.id)}
              type="button"
            >
              <Icon size={16} aria-hidden />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {activeTab === "characters" ? <AdminCharactersPanel adminPassword={adminPassword} /> : null}
      {activeTab === "groups" ? <AdminGroupsPanel adminPassword={adminPassword} /> : null}
      {activeTab === "traits" ? <AdminTraitsPanel adminPassword={adminPassword} /> : null}
      {activeTab === "quests" ? <AdminQuestsPanel adminPassword={adminPassword} /> : null}
      {activeTab === "articles" ? <AdminArticlesPanel adminPassword={adminPassword} /> : null}
      {activeTab === "detailCandidates" ? <AdminCharacterDetailCandidatesPanel adminPassword={adminPassword} /> : null}
      {activeTab === "rarity" ? <AdminSpecialRarityPanel adminPassword={adminPassword} /> : null}
      {activeTab === "data" ? (
        <section className="section admin-placeholder-panel">
          <h2>データ確認</h2>
          <p className="muted">
            キャラクターデータ、manual補正、グループ表示順、画像保存先などの確認画面をここに集約予定です。
          </p>
        </section>
      ) : null}
      {activeTab === "settings" ? (
        <AdminSiteNavigationPanel adminPassword={adminPassword} />
      ) : null}
    </div>
  );
}
