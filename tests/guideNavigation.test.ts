import test from "node:test";
import assert from "node:assert/strict";
import { GUIDE_LINKS, guidePageLayout } from "../lib/guideNavigation.ts";

test("public navigation preserves reader tools without exposing management links", () => {
  for (const [id, href] of Object.entries({ home: "/", characters: "/characters", team: "/team", damage: "/damage", quests: "/quests", settings: "/settings", articles: "/articles" })) {
    assert.equal(GUIDE_LINKS.find(link => link.id === id)?.href, href);
    assert.equal(guidePageLayout(href).active, id);
  }
  assert.ok(GUIDE_LINKS.every(link => !link.href.startsWith("/admin") && !["/logs"].includes(link.href)));
});

test("detail pages select their parent navigation without matching unrelated prefixes", () => {
  assert.equal(guidePageLayout("/characters/stable-character-id").active, "characters");
  assert.equal(guidePageLayout("/articles/event-kotoiro/").active, "articles");
  assert.equal(guidePageLayout("/admin/characters").active, "admin");
  assert.equal(guidePageLayout("/characters-other").active, undefined);
});

test("search, deck and admin keep a wider main area while reading pages allow related articles", () => {
  for (const href of ["/characters", "/characters/", "/team", "/admin", "/admin/characters"]) {
    assert.equal(guidePageLayout(href).variant, "wide");
  }
  for (const href of ["/", "/characters/id", "/articles", "/articles/event", "/quests"]) {
    assert.equal(guidePageLayout(href).variant, "standard");
  }
});

test("authenticated preview routes use the same layout as their destination without becoming editors", () => {
  assert.deepEqual(guidePageLayout("/admin/home-preview"), { active: "home", variant: "standard", editor: false });
  assert.deepEqual(guidePageLayout("/admin/article-layout-preview"), { active: "articles", variant: "standard", editor: false });
  assert.equal(guidePageLayout("/admin").editor, true);
});
