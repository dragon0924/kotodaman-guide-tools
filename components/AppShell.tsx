"use client";

import type { ReactNode } from "react";
import { APP_TABS, type AppTabId } from "./SidebarNav";

type AppShellProps = {
  activeTab: AppTabId;
  children: ReactNode;
};

export function AppShell({ activeTab, children }: AppShellProps) {
  const title = APP_TABS.find((tab) => tab.id === activeTab)?.label ?? "ホーム";

  return (
      <div className="workspace-content">
        <div className="tab-title-row">
          <h2>{title}</h2>
        </div>
        {children}
      </div>
  );
}
