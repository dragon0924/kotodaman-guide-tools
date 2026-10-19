import { isAdminRequest } from "@/lib/server/adminAuth";
import {NextRequest,NextResponse} from "next/server";
import {getCharacterCache} from "@/lib/characterStore";
import {readArticles} from "@/lib/articleStore";
import {readSiteNavigation,writeSiteNavigation,NavigationConflictError} from "@/lib/siteNavigationStore";
import {navigationArticle,publicNavigationArticles} from "@/lib/siteNavigation";

export const dynamic="force-dynamic";
const headers={"cache-control":"private, no-store",vary:"x-admin-password"};
const authorized = isAdminRequest;
async function options(){
  const [all,articles]=await Promise.all([getCharacterCache(),readArticles()]);
  return {characterOptions:all.characters.map(c=>({id:c.id,name:c.name,imageUrl:c.imageUrl,attribute:c.attribute,attributes:c.attributes,species:c.species,race:c.race,letters:c.letters})),articleOptions:publicNavigationArticles(articles.articles).map(navigationArticle)};
}
export async function GET(request:NextRequest){
  if(!authorized(request))return new NextResponse("Unauthorized",{status:401,headers});
  try{const [snapshot,choices]=await Promise.all([readSiteNavigation(),options()]);return NextResponse.json({...snapshot,...choices},{headers});}
  catch(error){return new NextResponse(error instanceof Error?error.message:"表示設定を読み込めませんでした。",{status:500,headers});}
}
export async function PUT(request:NextRequest){
  if(!authorized(request))return new NextResponse("Unauthorized",{status:401,headers});
  const expectedRevision=request.headers.get("if-match");if(!expectedRevision)return new NextResponse("再読み込みしてから保存してください。",{status:428,headers});
  try{const value:unknown=await request.json(),choices=await options();const snapshot=await writeSiteNavigation(value,{expectedRevision,characterIds:new Set(choices.characterOptions.map(c=>c.id)),articleIds:new Set(choices.articleOptions.map(a=>a.id))});return NextResponse.json({...snapshot,...choices},{headers});}
  catch(error){return new NextResponse(error instanceof Error?error.message:"保存できませんでした。",{status:error instanceof NavigationConflictError?412:400,headers});}
}
