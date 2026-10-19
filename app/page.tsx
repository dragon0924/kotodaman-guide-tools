"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { HomeEventArea } from "@/components/HomeEventArea";
import { CharacterSearchPanel } from "@/components/CharacterSearchPanel";
import { DeckEditor } from "@/components/DeckEditor";
import { useWorkspaceDeck } from "@/components/WorkspaceDeckProvider";
import type { AppTabId } from "@/components/SidebarNav";
import { loadCharacterMeta } from "@/lib/characters";
import type { CharacterDataMeta, CharacterSearchResult, DeckCharacter } from "@/lib/types";

function hashToTab(hash: string): AppTabId {
  const raw = hash.replace("#", "");
  switch (raw) {
    case "home":
      return "home";
    case "deck":
    case "team":
      return "team";
    case "characters":
      return "characters";
    case "damage":
      return "damage";
    case "quests":
      return "quests";
    case "settings":
      return "settings";
    default:
      return "home";
  }
}

function pathToTab(pathname: string): AppTabId {
  switch (pathname.replace(/\/+$/u, "") || "/") {
    case "/":
      return "home";
    case "/characters":
      return "characters";
    case "/team":
      return "team";
    case "/damage":
      return "damage";
    case "/quests":
      return "quests";
    case "/settings":
      return "settings";
    default:
      return "home";
  }
}

function toDeckCharacter(character: CharacterSearchResult, slotId: number): DeckCharacter {
  return {
    id: slotId,
    name: character.name,
    attribute: character.attribute,
    attributes: character.attributes?.length ? character.attributes : [character.attribute].filter(Boolean),
    race: character.race,
    species: character.species,
    letters: character.letters ?? [],
    letterAttributes: character.letterAttributes ?? [],
    leaderTraits: character.leaderTraits,
    gimmicks: character.gimmicks,
    groups: character.groups,
    collabGroups: character.collabGroups,
    sourceUrl: character.sourceUrl,
    imageUrl: character.imageUrl,
    imageSourceUrl: character.imageSourceUrl,
  };
}

export default function Home() {
  const pathname = usePathname();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AppTabId>(() => pathToTab(pathname));
  const { deck, setDeck } = useWorkspaceDeck();
  const [characterMeta, setCharacterMeta] = useState<CharacterDataMeta | null>(null);
  const [isCharacterLoading, setIsCharacterLoading] = useState(true);
  const [characterError, setCharacterError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCharactersMeta() {
      setIsCharacterLoading(true);
      setCharacterError(null);

      try {
        const result = await loadCharacterMeta();
        if (!cancelled) {
          setCharacterMeta(result.meta);
        }
      } catch (caught) {
        if (!cancelled) {
          const message =
            caught instanceof Error ? caught.message : "キャラクターデータの読み込みに失敗しました。";
          console.error("[KotodamanCharacters]", message);
          setCharacterMeta(null);
          setCharacterError(message);
        }
      } finally {
        if (!cancelled) {
          setIsCharacterLoading(false);
        }
      }
    }

    loadCharactersMeta();

    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    const syncActiveTab = () => {
      const nextTab = window.location.hash
        ? hashToTab(window.location.hash)
        : pathToTab(window.location.pathname);
      setActiveTab(nextTab);
    };

    syncActiveTab();
    window.addEventListener("hashchange", syncActiveTab);
    window.addEventListener("popstate", syncActiveTab);
    return () => {
      window.removeEventListener("hashchange", syncActiveTab);
      window.removeEventListener("popstate", syncActiveTab);
    };
  }, [pathname]);

  function handleTabChange(tab: AppTabId) {
    setActiveTab(tab);
    router.push(tab === "home" ? "/" : "/" + tab);
  }

  function handleAddToDeckSlot(character: CharacterSearchResult, slotId: number) {
    setDeck((currentDeck) =>
      currentDeck.map((slot) => (slot.id === slotId ? toDeckCharacter(character, slotId) : slot)),
    );
  }

  function handleAddToNextEmpty(character: CharacterSearchResult) {
    setDeck((currentDeck) => {
      const emptySlot = currentDeck.find((slot) => !slot.name);
      if (!emptySlot) {
        return currentDeck;
      }
      return currentDeck.map((slot) =>
        slot.id === emptySlot.id ? toDeckCharacter(character, emptySlot.id) : slot,
      );
    });
  }

  return (
    <div className={`tabbed-page tab-${activeTab}`}>
      <AppShell activeTab={activeTab}>
        <div className="tabbed-main">
          <section className="section home-tab-section tab-panel">
            <HomeEventArea />
            <div className="home-dashboard">
              <article className="home-panel home-event-panel">
                <div className="home-panel-heading">
                  <span>攻略メニュー</span>
                  <strong>公開版</strong>
                </div>
                <h3>キャラ検索と編成支援を中心に攻略条件を整理</h3>
                <dl className="home-event-list">
                  <div>
                    <dt>キャラ検索</dt>
                    <dd>属性、種族、持ち文字、ギミック耐性、特性テンプレートで絞り込みます。</dd>
                  </div>
                  <div>
                    <dt>編成管理</dt>
                    <dd>検索結果から12枠の編成へ追加し、手持ちの候補を整理できます。</dd>
                  </div>
                  <div>
                    <dt>クエスト攻略</dt>
                    <dd>クエスト条件と適正キャラを見ながら攻略準備を進めます。</dd>
                  </div>
                </dl>
                <div className="home-actions">
                  <button className="primary" onClick={() => handleTabChange("characters")}>
                    キャラ検索を開く
                  </button>
                  <button onClick={() => handleTabChange("team")}>編成管理を開く</button>
                </div>
              </article>

              <article className="home-panel">
                <div className="home-panel-heading">
                  <span>更新メモ</span>
                </div>
                <ul className="home-news-list">
                  <li>
                    <strong>特性テンプレート検索</strong>
                    <span>通常特性、祝福特性、大討伐特性を分けて確認できます。</span>
                  </li>
                  <li>
                    <strong>キャラ詳細</strong>
                    <span>とくせい、祝福特性、わざ情報をキャラごとに確認できます。</span>
                  </li>
                  <li>
                    <strong>イベント・攻略記事</strong>
                    <span>公開済みのイベント情報とクエスト攻略記事を確認できます。</span>
                  </li>
                </ul>
              </article>
            </div>

            <div className="home-hero">
              <p>
                このページは、キャラ検索、特性検索、編成支援、クエスト攻略支援をまとめた攻略支援サイトです。
                盤面OCRやことば候補検索に頼らず、キャラクター情報から攻略条件を絞り込める構成にしています。
              </p>
              <div className="site-feature-grid">
                <article>
                  <h3>キャラ検索</h3>
                  <p>属性、種族、持ち文字、ギミック耐性、リーダー特性で絞り込みます。</p>
                </article>
                <article>
                  <h3>特性検索</h3>
                  <p>通常特性、祝福特性、大討伐特性テンプレートから候補を探せます。</p>
                </article>
                <article>
                  <h3>編成支援</h3>
                  <p>検索結果を編成枠へ追加して、攻略用の候補を並べられます。</p>
                </article>
                <article>
                  <h3>クエスト攻略</h3>
                  <p>クエスト情報と適正条件を管理しながら攻略準備を進めます。</p>
                </article>
              </div>
            </div>
          </section>

          <section className="characters-browser-panel tab-panel">
            <CharacterSearchPanel
              error={characterError}
              isLoading={isCharacterLoading}
              meta={characterMeta}
            />
          </section>

          <section className="deck-characters-panel tab-panel">
            <DeckEditor deck={deck} onChange={setDeck} />
            <CharacterSearchPanel
              deck={deck}
              error={characterError}
              isLoading={isCharacterLoading}
              meta={characterMeta}
              mode="selectForTeam"
              onAddToDeckSlot={handleAddToDeckSlot}
              onAddToNextEmpty={handleAddToNextEmpty}
            />
          </section>

          <section className="section placeholder-tab-section damage-tab-section tab-panel">
            <h2>ダメージ計算</h2>
            <p>ダメージ計算は今後の拡張領域です。現在はキャラ検索と編成管理を中心に利用できます。</p>
          </section>

          <section className="section placeholder-tab-section quests-tab-section tab-panel">
            <h2>クエスト攻略</h2>
            <p>クエスト管理画面で登録した情報をもとに、攻略条件や適正候補を確認できます。</p>
          </section>

          <section className="section placeholder-tab-section settings-tab-section tab-panel">
            <h2>設定</h2>
            <p>表示や検索の設定は今後ここにまとめます。</p>
          </section>

        </div>
      </AppShell>
    </div>
  );
}
