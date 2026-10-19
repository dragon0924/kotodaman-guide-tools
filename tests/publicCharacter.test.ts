import test from "node:test";
import assert from "node:assert/strict";
import { publicCharacterFields } from "../lib/publicCharacter.ts";

test("reader payloads omit internal notes without changing the database object or public character information", () => {
  const raw = Object.freeze({ id: "separate-form", name: "同名キャラ", memo: "読者向け補足", adminMemo: "PRIVATE_MANAGER_NOTE", letters: ["あ"], superMove: { text: "取得済みすごわざ" } });
  const result = publicCharacterFields(raw);
  assert.equal(Object.hasOwn(result, "adminMemo"), false);
  assert.ok(!JSON.stringify(result).includes("PRIVATE_MANAGER_NOTE"));
  assert.deepEqual(result, { id: raw.id, name: raw.name, memo: raw.memo, letters: raw.letters, superMove: raw.superMove });
  assert.equal(raw.adminMemo, "PRIVATE_MANAGER_NOTE");
});
