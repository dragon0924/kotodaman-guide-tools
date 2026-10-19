import { notFound, redirect } from "next/navigation";
import { adminFeaturesEnabled } from "@/lib/server/siteMode";
export default function LegacyLogsPage() {
  if (!adminFeaturesEnabled()) notFound();
  redirect("/admin/logs");
}
