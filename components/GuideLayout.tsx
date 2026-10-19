import type {ReactNode} from "react";
import {getPublicSiteNavigation} from "@/lib/siteNavigationData";
import {GuideSiteLayout} from "./GuideSiteLayout";
import {headers} from "next/headers";

export async function GuideLayout({children}:{children:ReactNode}){
  if ((await headers()).get("x-kotodaman-surface") === "admin") return children;
  const data=await getPublicSiteNavigation();
  return <GuideSiteLayout initialData={data}>{children}</GuideSiteLayout>;
}
