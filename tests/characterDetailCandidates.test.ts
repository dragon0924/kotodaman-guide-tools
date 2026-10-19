import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  DETAIL_FIELDS,
  applyCandidateApprovals,
  mergeDetailCandidates,
} from "../lib/characterDetailCandidates.ts";
import { writeJsonFilesSafely } from "../lib/server/safeJsonFiles.ts";
import type { CharacterDetailCandidate } from "../lib/types";

function candidate(id: string, patch: Partial<CharacterDetailCandidate> = {}): CharacterDetailCandidate {
  return {
    characterId: id,
    name: `character-${id}`,
    sourceUrl: `https://example.test/${id}`,
    normalMove: { condition: "3文字以上", effect: `normal-${id}` },
    superMove: { condition: "4文字以上", effect: `super-${id}` },
    traitsRaw: [`trait-${id}`],
    extractedAt: "2026-07-22T00:00:00.000Z",
    ...patch,
  };
}

test("100件の候補は全URL処理済み相当の空入力でも保持される", () => {
  const existing = Array.from({ length: 100 }, (_, index) => candidate(String(index)));
  const result = mergeDetailCandidates(existing, []);
  assert.equal(result.candidates.length, 100);
  assert.deepEqual(result.stats, {
    existingCount: 100,
    incomingCount: 0,
    addedCount: 0,
    updatedCount: 0,
    retainedCount: 100,
    deletedCount: 0,
    ignoredEmptyCount: 0,
    invalidCount: 0,
  });
});

test("追加取得した候補だけが増え、同一候補の再取得は重複しない", () => {
  const existing = [candidate("a")];
  const added = candidate("b");
  const first = mergeDetailCandidates(existing, [added]);
  assert.equal(first.candidates.length, 2);
  assert.equal(first.stats.addedCount, 1);

  const second = mergeDetailCandidates(first.candidates, [
    { ...added, extractedAt: "2026-07-23T00:00:00.000Z" },
  ]);
  assert.equal(second.candidates.length, 2);
  assert.equal(second.stats.addedCount, 0);
  assert.equal(second.stats.updatedCount, 0);
});

test("空の再取得結果は既存候補の有効なフィールドを削除しない", () => {
  const existing = candidate("a");
  const empty = candidate("a", {
    normalMove: undefined,
    superMove: undefined,
    traitsRaw: undefined,
    rawSections: undefined,
    extractedLetters: undefined,
    extractedLetterAttributes: undefined,
    extractedAt: "2026-07-23T00:00:00.000Z",
  });
  const result = mergeDetailCandidates([existing], [empty]);
  assert.deepEqual(result.candidates, [existing]);
  assert.equal(result.stats.ignoredEmptyCount, 1);
});

test("再取得で一部フィールドだけ取れなくても既存候補を保持して更新する", () => {
  const existing = candidate("a");
  const partial = candidate("a", {
    normalMove: { effect: "updated-normal" },
    superMove: undefined,
    traitsRaw: undefined,
    extractedAt: "2026-07-23T00:00:00.000Z",
  });
  const result = mergeDetailCandidates([existing], [partial]);
  assert.equal(result.candidates[0].normalMove?.effect, "updated-normal");
  assert.equal(result.candidates[0].superMove?.effect, "super-a");
  assert.deepEqual(result.candidates[0].traitsRaw, ["trait-a"]);
  assert.equal(result.stats.updatedCount, 1);
});

test("わざだけ承認すると、すごわざと特性は候補に残る", () => {
  const target = candidate("a");
  const other = candidate("b");
  const result = applyCandidateApprovals({
    candidates: [target, other],
    manualCharacters: [{ id: "a", name: "character-a" }],
    baseCharacters: [],
    characterIds: ["a"],
    fieldsByCharacterId: { a: ["normalMove"] },
    updatedAt: "2026-07-24T00:00:00.000Z",
  });

  assert.equal(result.candidates.length, 2);
  const remaining = result.candidates.find((item) => item.characterId === "a");
  assert.equal(remaining?.normalMove, undefined);
  assert.equal(remaining?.superMove?.effect, "super-a");
  assert.deepEqual(remaining?.traitsRaw, ["trait-a"]);
  assert.equal(result.candidates.find((item) => item.characterId === "b"), other);
  assert.equal(result.manualCharacters[0].normalMove?.effect, "normal-a");
});

test("全フィールド承認後は対象候補だけを整理する", () => {
  const target = candidate("a");
  const other = candidate("b");
  const result = applyCandidateApprovals({
    candidates: [target, other],
    manualCharacters: [{ id: "a", name: "character-a" }],
    baseCharacters: [],
    characterIds: ["a"],
    fieldsByCharacterId: { a: DETAIL_FIELDS },
    updatedAt: "2026-07-24T00:00:00.000Z",
  });
  assert.deepEqual(result.candidates.map((item) => item.characterId), ["b"]);
  assert.equal(result.removedCandidates, 1);
  assert.equal(result.candidates[0], other);
});

test("未選択・空値はmanualを書き換えない", () => {
  const target = candidate("a", { normalMove: { condition: "", effect: "" } });
  const manual = { id: "a", name: "character-a", normalMove: { effect: "keep-me" } };
  const result = applyCandidateApprovals({
    candidates: [target],
    manualCharacters: [manual],
    baseCharacters: [],
    characterIds: ["a"],
    fieldsByCharacterId: { a: ["normalMove"] },
    updatedAt: "2026-07-24T00:00:00.000Z",
  });
  assert.deepEqual(result.manualCharacters, [manual]);
  assert.equal(result.manualChangedCount, 0);
  assert.equal(result.candidates.length, 1);

  const noSelection = applyCandidateApprovals({
    candidates: [candidate("b")],
    manualCharacters: [{ id: "b", name: "character-b" }],
    baseCharacters: [],
    characterIds: ["b"],
    fieldsByCharacterId: { b: [] },
    updatedAt: "2026-07-24T00:00:00.000Z",
  });
  assert.equal(noSelection.manualChangedCount, 0);
  assert.equal(noSelection.candidates.length, 1);
});

test("manualが既に同じ値なら候補だけ処理し、不要なmanual変更を起こさない", () => {
  const target = candidate("a", { superMove: undefined, traitsRaw: undefined });
  const manual = {
    id: "a",
    name: "character-a",
    normalMove: { condition: "3文字以上", effect: "normal-a" },
  };
  const result = applyCandidateApprovals({
    candidates: [target],
    manualCharacters: [manual],
    baseCharacters: [],
    characterIds: ["a"],
    fieldsByCharacterId: { a: ["normalMove"] },
    updatedAt: "2026-07-24T00:00:00.000Z",
  });
  assert.equal(result.manualChangedCount, 0);
  assert.deepEqual(result.manualCharacters, [manual]);
  assert.equal(result.candidates.length, 0);
});

test("2ファイル保存の途中で失敗しても両方の既存JSONを復旧する", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "kotodaman-json-transaction-"));
  const firstPath = path.join(directory, "manual.json");
  const secondPath = path.join(directory, "candidates.json");
  await writeFile(firstPath, '{"value":"old-manual"}\n', "utf8");
  await writeFile(secondPath, '{"value":"old-candidates"}\n', "utf8");

  try {
    await assert.rejects(
      writeJsonFilesSafely(
        [
          { path: firstPath, value: { value: "new-manual" } },
          { path: secondPath, value: { value: "new-candidates" } },
        ],
        {
          beforeReplace: (_targetPath, index) => {
            if (index === 1) throw new Error("injected save failure");
          },
        },
      ),
      /injected save failure/,
    );
    assert.deepEqual(JSON.parse(await readFile(firstPath, "utf8")), { value: "old-manual" });
    assert.deepEqual(JSON.parse(await readFile(secondPath, "utf8")), { value: "old-candidates" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("2ファイルを検証後にまとめて保存できる", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "kotodaman-json-success-"));
  const firstPath = path.join(directory, "manual.json");
  const secondPath = path.join(directory, "candidates.json");
  await writeFile(firstPath, '{"value":"old-manual"}\n', "utf8");
  await writeFile(secondPath, '{"value":"old-candidates"}\n', "utf8");

  try {
    await writeJsonFilesSafely([
      { path: firstPath, value: { value: "new-manual" } },
      { path: secondPath, value: { value: "new-candidates" } },
    ]);
    assert.deepEqual(JSON.parse(await readFile(firstPath, "utf8")), { value: "new-manual" });
    assert.deepEqual(JSON.parse(await readFile(secondPath, "utf8")), { value: "new-candidates" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("検証に失敗したJSONは既存ファイルを置き換えない", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "kotodaman-json-validation-"));
  const targetPath = path.join(directory, "target.json");
  await writeFile(targetPath, '{"value":"old"}\n', "utf8");
  try {
    await assert.rejects(
      writeJsonFilesSafely([
        {
          path: targetPath,
          value: { value: "new" },
          validate: () => {
            throw new Error("invalid fixture");
          },
        },
      ]),
      /invalid fixture/,
    );
    assert.deepEqual(JSON.parse(await readFile(targetPath, "utf8")), { value: "old" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
