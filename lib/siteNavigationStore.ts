import {readFile} from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
import {writeJsonFilesSafely} from "./server/safeJsonFiles.ts";
import {emptySiteNavigation,validateSiteNavigation,type SiteNavigationSettings} from "./siteNavigation.ts";

export const SITE_NAVIGATION_PATH=path.join(process.env.SITE_NAVIGATION_DIRECTORY?path.resolve(process.env.SITE_NAVIGATION_DIRECTORY):path.join(process.cwd(),"data"),"siteNavigation.json");
export class NavigationConflictError extends Error {}
export async function readSiteNavigation(filePath=SITE_NAVIGATION_PATH){
  try{const bytes=await readFile(filePath),settings:unknown=JSON.parse(bytes.toString("utf8"));validateSiteNavigation(settings);return {settings,revision:createHash("sha256").update(bytes).digest("hex")};}
  catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;return {settings:emptySiteNavigation(),revision:"missing"};}
}
let writeQueue:Promise<unknown>=Promise.resolve();
export function writeSiteNavigation(value:unknown,options:{expectedRevision:string;filePath?:string;characterIds:Set<string>;articleIds:Set<string>}){
  const write=async()=>{
    const filePath=options.filePath??SITE_NAVIGATION_PATH;
    validateSiteNavigation(value,options);
    const before=await readSiteNavigation(filePath);
    if(before.revision!==options.expectedRevision)throw new NavigationConflictError("表示設定が別の操作で更新されています。再読み込みしてください。");
    const settings:SiteNavigationSettings={...value,newCharacterIds:[...value.newCharacterIds],recommendedArticleIds:[...value.recommendedArticleIds],updatedAt:new Date().toISOString()};
    await writeJsonFilesSafely([{path:filePath,value:settings,validate:v=>validateSiteNavigation(v,options)}],{beforeReplace:async()=>{if((await readSiteNavigation(filePath)).revision!==before.revision)throw new NavigationConflictError("保存中に設定が更新されました。再読み込みしてください。");}});
    return readSiteNavigation(filePath);
  };
  const pending=writeQueue.then(write,write);writeQueue=pending.catch(()=>undefined);return pending;
}
