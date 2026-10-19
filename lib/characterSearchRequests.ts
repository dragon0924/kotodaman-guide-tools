/** An empty, completed search is also a result worth restoring. */
export function hasRestorableCharacterSearchResults(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const saved = value as { results?: unknown; appliedSearchStamp?: unknown };
  return Array.isArray(saved.results) && typeof saved.appliedSearchStamp === "string";
}

/** Only an explicit, still-current search may move the result into view. */
export function createCharacterSearchRequests() {
  let latest = 0;
  let scrollRequest = 0;
  return {
    begin(kind: "initial" | "submit" | "more") {
      latest += 1;
      scrollRequest = kind === "submit" ? latest : 0;
      return latest;
    },
    isCurrent(request: number) {
      return request === latest;
    },
    cancelScroll() {
      scrollRequest = 0;
    },
    consumeScroll(request: number) {
      if (request !== latest || request !== scrollRequest) return false;
      scrollRequest = 0;
      return true;
    },
  };
}
