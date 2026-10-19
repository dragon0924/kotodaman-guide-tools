/** Management notes stay in the local database and admin API, never reader payloads. */
export function publicCharacterFields<T extends object>(character: T): Omit<T, "adminMemo"> {
  const result: T & { adminMemo?: unknown } = { ...character };
  delete result.adminMemo;
  return result;
}
