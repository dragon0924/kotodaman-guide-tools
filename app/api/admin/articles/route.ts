import { isAdminRequest } from "@/lib/server/adminAuth";
import { NextRequest, NextResponse } from "next/server";
import { ArticleConflictError, readArticleSnapshot, readArticleTemplates, writeArticles } from "@/lib/articleStore";
import { searchCharacterCache } from "@/lib/characterStore";
import type { Article, ArticleFile } from "@/lib/types";

function unauthorized() {
  return new NextResponse("Unauthorized", { status: 401 });
}

function assertAdmin(request: NextRequest) {
  return isAdminRequest(request);
}

export async function GET(request: NextRequest) {
  if (!assertAdmin(request)) {
    return unauthorized();
  }
  try { return NextResponse.json(await responseData(), {headers:{"cache-control":"no-store"}}); }
  catch(error){return new NextResponse(error instanceof Error?error.message:"記事を読み込めませんでした。",{status:500});}
}

async function responseData() {
  const [snapshot, templates, all] = await Promise.all([
    readArticleSnapshot(),
    readArticleTemplates(),
    searchCharacterCache("",5000),
  ]);
  return {
    path: "data/articles.json",
    templatePath: "data/articleTemplates.json",
    ...snapshot.file,
    revision:snapshot.revision,
    templates: templates.templates,
    templateMeta: templates.meta,
    characterOptions:all.results.map(c=>({id:c.id,name:c.name,imageUrl:c.imageUrl,attribute:c.attribute,attributes:c.attributes,race:c.race,species:c.species,letters:c.letters})),
  };
}

export async function PUT(request: NextRequest) {
  if (!assertAdmin(request)) {
    return unauthorized();
  }
  const revision=request.headers.get("if-match");
  if(!revision)return new NextResponse("再読み込みしてから保存してください。",{status:428});
  try {
    const payload=await request.json() as ArticleFile;
    const all=await searchCharacterCache("",5000);
    await writeArticles(payload,{expectedRevision:revision,characterIds:new Set(all.results.map(c=>c.id))});
    return NextResponse.json(await responseData(),{headers:{"cache-control":"no-store"}});
  }catch(error){return new NextResponse(error instanceof Error?error.message:"記事を保存できませんでした。",{status:error instanceof ArticleConflictError?412:400});}
}

// The visual editor saves one article at a time. The legacy collection PUT remains available.
async function editOne(request:NextRequest,remove:boolean) {
  if(!assertAdmin(request))return unauthorized();
  const revision=request.headers.get("if-match");
  if(!revision)return new NextResponse("再読み込みしてから保存してください。",{status:428});
  try {
    const payload=await request.json() as {article?:Article;id?:string},snapshot=await readArticleSnapshot();
    const id=remove?payload.id:payload.article?.id;
    if(typeof id!=="string"||!id)throw new Error("記事IDを指定してください。");
    if(remove&&!snapshot.file.articles.some(a=>a.id===id))throw new Error("記事がありません。");
    const articles=remove?snapshot.file.articles.filter(a=>a.id!==id):snapshot.file.articles.some(a=>a.id===id)?snapshot.file.articles.map(a=>a.id===id?payload.article!:a):[...snapshot.file.articles,payload.article!];
    const all=await searchCharacterCache("",5000);
    await writeArticles({...snapshot.file,articles},{expectedRevision:revision,characterIds:new Set(all.results.map(c=>c.id))});
    return NextResponse.json(await responseData(),{headers:{"cache-control":"no-store"}});
  } catch(error){return new NextResponse(error instanceof Error?error.message:"記事を保存できませんでした。",{status:error instanceof ArticleConflictError?412:400});}
}
export async function PATCH(request:NextRequest){return editOne(request,false);}
export async function DELETE(request:NextRequest){return editOne(request,true);}
