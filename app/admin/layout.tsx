import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { adminFeaturesEnabled } from "@/lib/server/siteMode";
import { getPublicSiteNavigation } from "@/lib/siteNavigationData";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "ローカル管理 | コトダマン攻略支援", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!adminFeaturesEnabled()) notFound();
  return <AdminShell navigation={await getPublicSiteNavigation()}>{children}</AdminShell>;
}
