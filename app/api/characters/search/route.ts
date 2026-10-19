import { NextRequest, NextResponse } from "next/server";
import { searchCharacterCache } from "@/lib/characterStore";
import type { CharacterSearchFilters } from "@/lib/types";

function listParam(request: NextRequest, key: string) {
  return request.nextUrl.searchParams
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q") ?? "";
    const refresh = false; // Public requests never invalidate the complete character index.
    const limit = Math.min(
      5000,
      Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 100) || 100),
    );
    const filters: CharacterSearchFilters = {
      attributes: listParam(request, "attributes"),
      species: listParam(request, "species"),
      leaderTraits: listParam(request, "leaderTraits"),
      gimmicks: listParam(request, "gimmicks"),
      superGimmicks: listParam(request, "superGimmicks"),
      groups: listParam(request, "groups"),
      letters: listParam(request, "letters"),
      traits: listParam(request, "traits"),
      traitNames: listParam(request, "traitNames"),
      traitCategories: listParam(request, "traitCategories"),
      traitSource: request.nextUrl.searchParams.get("traitSource") === "blessing" ? "blessing" : request.nextUrl.searchParams.get("traitSource") === "raid" ? "raid" : "normal",
      traitMatchMode: request.nextUrl.searchParams.get("traitMatchMode") === "or" ? "or" : "and",
      rarityTypes: listParam(request, "rarityTypes"),
      matchMode: request.nextUrl.searchParams.get("matchMode") === "and" ? "and" : "or",
      letterMatchMode: request.nextUrl.searchParams.get("letterMatchMode") === "and" ? "and" : "or",
    };
    const result = await searchCharacterCache(query, limit, refresh, filters);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[KotodamanCharactersSearch]", message);
    return new NextResponse("データを読み込めませんでした。", { status: 500 });
  }
}
