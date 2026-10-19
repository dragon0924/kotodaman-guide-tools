import { NextResponse } from "next/server";
import { getCharacterMeta } from "@/lib/characterStore";
import type { CharacterMetaResult } from "@/lib/types";

export async function GET() {
  try {
    const refresh = false; // Public requests never invalidate the complete character index.
    const result: CharacterMetaResult = {
      meta: await getCharacterMeta(refresh),
    };
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[KotodamanCharactersMeta]", message);
    return new NextResponse("データを読み込めませんでした。", { status: 500 });
  }
}
