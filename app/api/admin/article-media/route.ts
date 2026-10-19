import { NextRequest, NextResponse } from "next/server";
import { articleMediaStorage, isArticleAdmin, MAX_IMAGE_BYTES } from "@/lib/server/articleMedia";
import { saveArticleImage } from "@/lib/server/articleImageOptimization";
import { MEDIA_PURPOSES, type MediaPurpose } from "@/lib/articleMedia";

export const runtime="nodejs";
export const dynamic="force-dynamic";
let uploads=0;
export async function POST(request:NextRequest) {
  if (!isArticleAdmin(request)) return new NextResponse("Unauthorized",{status:401});
  if (uploads>=3) return new NextResponse("アップロードが混雑しています。少し後に再試行してください。",{status:429});
  uploads++;
  try {
    const limit=MAX_IMAGE_BYTES+65536;
    if (Number(request.headers.get("content-length"))>limit) return new NextResponse("画像は10MB以下で指定してください。",{status:413});
    const reader=request.body?.getReader();if(!reader)throw new Error("画像ファイルを指定してください。");
    const chunks:Uint8Array[]=[];let total=0;
    while(true){const next=await reader.read();if(next.done)break;total+=next.value.byteLength;if(total>limit){await reader.cancel();return new NextResponse("画像は10MB以下で指定してください。",{status:413});}chunks.push(next.value);}
    const form=await new Response(Buffer.concat(chunks),{headers:{"content-type":request.headers.get("content-type")??""}}).formData();
    const file=form.get("image");
    if (!(file instanceof File) || !["image/jpeg","image/png","image/webp","image/avif"].includes(file.type)) throw new Error("JPEG・PNG・WebP・AVIF画像を指定してください。");
    const purpose=form.get("purpose")??"article";
    if(typeof purpose!=="string"||!MEDIA_PURPOSES.includes(purpose as MediaPurpose))throw new Error("画像用途が不正です。");
    const image=await saveArticleImage(articleMediaStorage(),Buffer.from(await file.arrayBuffer()),purpose as MediaPurpose);
    return NextResponse.json({src:"/api/article-media/"+image.id,alt:"",width:image.master.width,height:image.master.height,bytes:image.master.bytes,format:image.master.format,sourceBytes:image.source.bytes,variants:image.variants.map(v=>({width:v.width,height:v.height,bytes:v.bytes,format:v.format}))},{headers:{"cache-control":"private, no-store"}});
  } catch(error) {return new NextResponse(error instanceof Error?error.message:"画像を保存できませんでした。",{status:400});}
  finally {uploads--;}
}
