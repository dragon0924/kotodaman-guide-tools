import type {
  CharacterMetaResult,
  CharacterSearchFilters,
  CharacterSearchResponse,
} from "./types";

export async function loadCharacterMeta(): Promise<CharacterMetaResult> {
  const response = await fetch("/api/characters/meta", {
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `キャラクターデータのメタ情報を読み込めませんでした: ${response.status}`);
  }

  const result = (await response.json()) as CharacterMetaResult;
  console.info("[KotodamanCharactersMeta]", result.meta);
  return result;
}

export async function searchCharacters(
  query: string,
  limit = 50,
  filters: CharacterSearchFilters = {},
): Promise<CharacterSearchResponse> {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set("q", query.trim());
  }
  params.set("limit", String(limit));
  for (const [key, values] of Object.entries(filters)) {
    if (key === "matchMode" || key === "letterMatchMode" || key === "traitMatchMode" || key === "traitSource") {
      if (values) {
        params.set(key, String(values));
      }
      continue;
    }
    for (const value of values ?? []) {
      params.append(key, value);
    }
  }

  const response = await fetch(`/api/characters/search?${params.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `キャラクター検索に失敗しました: ${response.status}`);
  }

  return (await response.json()) as CharacterSearchResponse;
}
