type SiteEnvironment = { NODE_ENV?: string; SITE_MODE?: string; PUBLIC_CONTENT_DIRECTORY?: string };

/** Production builds never permit management, even if an admin password is configured. */
export function adminFeaturesEnabled(environment: SiteEnvironment = { NODE_ENV: process.env.NODE_ENV, SITE_MODE: process.env.SITE_MODE }) {
  return environment.NODE_ENV !== "production"
    && (environment.SITE_MODE === undefined || environment.SITE_MODE === "local-admin");
}

export function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/")
    || pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}

export function publicContentDirectory(environment: SiteEnvironment = process.env) {
  return environment.PUBLIC_CONTENT_DIRECTORY || "content/public";
}
