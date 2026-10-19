"use client";

import type { LucideIcon } from "lucide-react";
import { Calculator, Home, Map, Search, Settings, Users } from "lucide-react";

export type AppTabId =
  | "home"
  | "characters"
  | "team"
  | "damage"
  | "quests"
  | "admin"
  | "logs"
  | "settings";

export const APP_TABS: Array<{
  id: AppTabId;
  label: string;
  path: string;
  icon: LucideIcon;
  badge?: string;
}> = [
  { id: "home", label: "ホーム", path: "/", icon: Home },
  { id: "characters", label: "キャラ検索", path: "/characters", icon: Search },
  { id: "team", label: "編成管理", path: "/team", icon: Users },
  { id: "damage", label: "ダメージ計算", path: "/damage", icon: Calculator, badge: "準備中" },
  { id: "quests", label: "クエスト攻略", path: "/quests", icon: Map },
  { id: "settings", label: "設定", path: "/settings", icon: Settings },
];

type SidebarNavProps = {
  activeTab: AppTabId;
  onChange: (tab: AppTabId) => void;
};

export function SidebarNav({ activeTab, onChange }: SidebarNavProps) {
  return (
    <nav className="sidebar-nav" aria-label="主要機能">
      {APP_TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <a
            className={activeTab === tab.id ? "active" : ""}
            href={tab.path}
            key={tab.id}
            onClick={(event) => {
              if (tab.path === "/characters" || tab.path.startsWith("/admin")) {
                return;
              }
              event.preventDefault();
              window.history.pushState(null, "", tab.path);
              onChange(tab.id);
            }}
          >
            <Icon size={16} aria-hidden />
            <span>{tab.label}</span>
            {tab.badge ? <small className="nav-badge">{tab.badge}</small> : null}
          </a>
        );
      })}
    </nav>
  );
}
