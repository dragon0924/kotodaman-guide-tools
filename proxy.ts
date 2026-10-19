import { NextRequest, NextResponse } from "next/server";
import { adminFeaturesEnabled, isAdminPath } from "./lib/server/siteMode";
import { publicCatalogHasArticle } from "./lib/server/publicCatalog";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const notFound = () => new NextResponse("Not found", { status: 404, headers: { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" } });
  if (!adminFeaturesEnabled() && (isAdminPath(pathname) || pathname === "/logs")) {
    return notFound();
  }
  // Reject hidden articles before streaming can commit a 200 status for an RSC response.
  const articlePath = pathname.match(/^\/articles\/([^/]+)\/?$/u);
  if (articlePath && !adminFeaturesEnabled()) {
    let slug: string;
    try { slug = decodeURIComponent(articlePath[1]); } catch { return notFound(); }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) return notFound();
    if (!await publicCatalogHasArticle(slug)) return notFound();
  }
  const headers = new Headers(request.headers);
  // This header selects presentation only, never authorization. Overwrite untrusted input.
  headers.set("x-kotodaman-surface", isAdminPath(pathname) ? "admin" : "public");
  const response = NextResponse.next({ request: { headers } });
  if (isAdminPath(pathname)) {
    response.headers.set("cache-control", "private, no-store");
    response.headers.set("x-robots-tag", "noindex, nofollow");
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
