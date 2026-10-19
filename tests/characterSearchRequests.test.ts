import test from "node:test";
import assert from "node:assert/strict";
import { createCharacterSearchRequests, hasRestorableCharacterSearchResults } from "../lib/characterSearchRequests.ts";

test("restored completed searches include zero matches and skip the initial recommendations", () => {
  assert.equal(hasRestorableCharacterSearchResults({ results: [], appliedSearchStamp: "zero-match-query" }), true);
  assert.equal(hasRestorableCharacterSearchResults({ results: [{ id: "existing" }], appliedSearchStamp: "saved-query" }), true);
  assert.equal(hasRestorableCharacterSearchResults({ results: [], appliedSearchStamp: null }), false);
  assert.equal(hasRestorableCharacterSearchResults({ results: "invalid", appliedSearchStamp: "query" }), false);
  assert.equal(hasRestorableCharacterSearchResults(null), false);
});

test("only explicit searches request a single result scroll", () => {
  const requests = createCharacterSearchRequests();
  assert.equal(requests.consumeScroll(requests.begin("initial")), false);
  const search = requests.begin("submit");
  assert.equal(requests.consumeScroll(search), true);
  assert.equal(requests.consumeScroll(search), false);
  assert.equal(requests.consumeScroll(requests.begin("more")), false);
});

test("late initial and earlier search responses cannot replace the latest results or scroll", () => {
  const requests = createCharacterSearchRequests();
  const initial = requests.begin("initial");
  const earlier = requests.begin("submit");
  const latest = requests.begin("submit");
  assert.equal(requests.isCurrent(initial), false);
  assert.equal(requests.isCurrent(earlier), false);
  assert.equal(requests.consumeScroll(earlier), false);
  assert.equal(requests.isCurrent(latest), true);
  assert.equal(requests.consumeScroll(latest), true);
});

test("clearing conditions or a failed request cancels pending movement without invalidating results", () => {
  const requests = createCharacterSearchRequests();
  const search = requests.begin("submit");
  requests.cancelScroll();
  assert.equal(requests.isCurrent(search), true);
  assert.equal(requests.consumeScroll(search), false);
  assert.equal(requests.consumeScroll(requests.begin("submit")), true);
});

test("loading more results supersedes any pending result scroll", () => {
  const requests = createCharacterSearchRequests();
  const search = requests.begin("submit");
  const more = requests.begin("more");
  assert.equal(requests.isCurrent(search), false);
  assert.equal(requests.consumeScroll(search), false);
  assert.equal(requests.consumeScroll(more), false);
});
