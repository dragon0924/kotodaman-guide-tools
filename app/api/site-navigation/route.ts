import { getPublicSiteNavigation } from "@/lib/siteNavigationData";

export const dynamic = "force-dynamic";

export async function GET() {
  // The same server-side public projection used by the initial layout; no admin data.
  return Response.json(await getPublicSiteNavigation(), { headers: { "Cache-Control": "no-store" } });
}
