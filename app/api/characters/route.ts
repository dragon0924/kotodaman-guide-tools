import { NextResponse } from "next/server";
import { getCharacterCache } from "@/lib/characterStore";
import { publicCharacterFields } from "@/lib/publicCharacter";
import type { CharacterLoadResult } from "@/lib/types";

export async function GET() {
  try {
    const refresh = false; // Public requests never invalidate the complete character index.
    const { characters, meta } = await getCharacterCache(refresh);
    const result: CharacterLoadResult = {
      characters: characters.map((character) => publicCharacterFields({
        id: character.id,
        name: character.name,
        attribute: character.attribute,
        attributes: character.attributes,
        species: character.species,
        race: character.race,
        letters: character.letters,
        letterAttributes: character.letterAttributes,
        leaderTraits: character.leaderTraits,
        gimmicks: character.gimmicks,
        superGimmicks: character.superGimmicks,
        groups: character.groups,
        collabGroups: character.collabGroups,
        rating: character.rating,
        sourceUrl: character.sourceUrl,
        updatedAt: character.updatedAt,
        imageUrl: character.imageUrl,
        imageSourceUrl: character.imageSourceUrl,
        memo: character.memo,
        review: character.review,
        recommendedQuests: character.recommendedQuests,
        adminMemo: character.adminMemo,
        leaderTraitText: character.leaderTraitText,
        normalMove: character.normalMove,
        superMove: character.superMove,
        kotowaza: character.kotowaza,
        traits: character.traits,
        renderedTraits: character.renderedTraits,
        rarityType: character.rarityType,
        rank: character.rank,
        retrievedAt: character.retrievedAt,
        updatedByManual: character.updatedByManual,
      })),
      meta,
    };
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[KotodamanCharacters]", message);
    return new NextResponse("データを読み込めませんでした。", { status: 500 });
  }
}
