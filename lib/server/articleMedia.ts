import { randomUUID } from "node:crypto";
import { mkdir, open, link, rm, readFile } from "node:fs/promises";
import path from "node:path";
import { isAdminRequest } from "./adminAuth.ts";
import { adminFeaturesEnabled, publicContentDirectory } from "./siteMode.ts";
export { MEDIA_ID } from "../articleMedia.ts";
export { MAX_IMAGE_BYTES, prepareArticleImage } from "./articleImageOptimization.ts";
const STORAGE_KEY=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(?:\.(?:webp|png|jpg)|\.meta\.json|\.source\.(?:webp|png|jpg|avif)|\.w(?:160|320|640|960|1440|1920)\.(?:webp|png|jpg))$/u;
export const mediaContentType=(key:string)=>key.endsWith(".json")?"application/json":key.endsWith(".jpg")?"image/jpeg":key.endsWith(".png")?"image/png":key.endsWith(".avif")?"image/avif":"image/webp";
export interface ArticleMediaStorage { put(id:string,bytes:Buffer):Promise<void>; get(id:string):Promise<Buffer>; remove(id:string):Promise<void>; }
export function articleMediaStorage():ArticleMediaStorage {
  if (!adminFeaturesEnabled() && (!process.env.ARTICLE_MEDIA_BACKEND || process.env.ARTICLE_MEDIA_BACKEND === "public-bundle")) {
    const directory = path.resolve(/* turbopackIgnore: true */ publicContentDirectory(), "media");
    return {
      get: async id => { if (!STORAGE_KEY.test(id)) throw new Error("画像IDが不正です。"); return readFile(/* turbopackIgnore: true */ path.join(directory, id)); },
      put: async () => { throw new Error("公開用画像は読み取り専用です。"); },
      remove: async () => { throw new Error("公開用画像は読み取り専用です。"); },
    };
  }
  const backend=process.env.ARTICLE_MEDIA_BACKEND??(process.env.NODE_ENV==="production"?"unconfigured":"local");
  if (backend==="http") {
    const origin=process.env.ARTICLE_MEDIA_STORAGE_URL,token=process.env.ARTICLE_MEDIA_STORAGE_TOKEN;
    if (!origin || !/^https:\/\//u.test(origin) || !token) throw new Error("永続画像ストレージの接続設定が必要です。");
    const request=async(id:string,method:string,bytes?:Buffer)=>{
      if (!STORAGE_KEY.test(id)) throw new Error("画像IDが不正です。");
      const response=await fetch(origin.replace(/\/$/u,"")+"/"+id,{method,headers:{authorization:"Bearer "+token,"content-type":mediaContentType(id),...(method==="PUT"?{"if-none-match":"*"}:{})},...(bytes?{body:new Uint8Array(bytes)}:{}),signal:AbortSignal.timeout(15000),redirect:"error"});
      if(response.status===404&&method==="GET")throw Object.assign(new Error("Image missing"),{code:"ENOENT"});
      if (!response.ok) throw new Error("画像ストレージへの保存または読み込みに失敗しました。");
      return response;
    };
    return {put:async(id,bytes)=>{await request(id,"PUT",bytes);},get:async id=>Buffer.from(await(await request(id,"GET")).arrayBuffer()),remove:async id=>{await request(id,"DELETE");}};
  }
  if (backend!=="local" || process.env.NODE_ENV==="production"&&process.env.ARTICLE_MEDIA_LOCAL_PERSISTENT!=="1") throw new Error("本番用の永続画像ストレージを設定してください。");
  // Media is runtime storage, not an application build asset. UUID checks still constrain every file operation.
  const directory=path.resolve(/* turbopackIgnore: true */ process.env.ARTICLE_MEDIA_DIRECTORY??path.join(process.cwd(),"var","article-media"));
  const location=(id:string)=>{if(!STORAGE_KEY.test(id))throw new Error("画像IDが不正です。");return path.join(/* turbopackIgnore: true */ directory,id);};
  return {
    put:async(id,bytes)=>{
      const target=location(id),temporary=target+"."+randomUUID()+".tmp";
      await mkdir(directory,{recursive:true});
      try {const file=await open(temporary,"wx");try {await file.writeFile(bytes);await file.sync();}finally{await file.close();} await link(temporary,target);}
      finally{await rm(temporary,{force:true});}
    },
    get:async id=>readFile(/* turbopackIgnore: true */ location(id)),
    remove:async id=>{await rm(/* turbopackIgnore: true */ location(id),{force:true});},
  };
}
export const isArticleAdmin = isAdminRequest;
