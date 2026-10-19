"use client";

import { Crown } from "lucide-react";
import { useState } from "react";
import type { CharacterLetter, DeckCharacter } from "@/lib/types";

type DeckEditorProps = {
  deck: DeckCharacter[];
  onChange: (deck: DeckCharacter[]) => void;
};

const DECK_STORAGE_KEY = "kotodaman-current-deck";

function splitLetters(rawValue: string) {
  return rawValue
    .split(/,|、|\s+/)
    .map((letter) => letter.trim())
    .filter(Boolean);
}

function attributesFor(character: DeckCharacter) {
  if (character.attributes?.length) {
    return character.attributes;
  }
  return character.attribute ? [character.attribute] : [];
}

function normalizeLetterAttributes(character: DeckCharacter, letters = character.letters) {
  const current = character.letterAttributes ?? [];
  const fallbackAttributes = attributesFor(character);
  return letters.map((letter) => {
    const existing = current.find((item) => item.letter === letter);
    return {
      letter,
      attributes: existing?.attributes?.length ? existing.attributes : fallbackAttributes,
    };
  });
}

function attributeClass(attribute?: string) {
  if (!attribute) return "attr-unknown";
  if (attribute.includes("火")) return "attr-fire";
  if (attribute.includes("水")) return "attr-water";
  if (attribute.includes("木")) return "attr-wood";
  if (attribute.includes("光")) return "attr-light";
  if (attribute.includes("闇")) return "attr-dark";
  if (attribute.includes("天")) return "attr-sky";
  if (attribute.includes("冥")) return "attr-nether";
  if (attribute.includes("虹")) return "attr-rainbow";
  return "attr-unknown";
}

function LetterAttributeTags({ letters }: { letters: CharacterLetter[] }) {
  if (!letters.length) {
    return <span className="muted">未登録</span>;
  }

  return (
    <>
      {letters.map((item) => (
        <span
          className={`tag letter-attribute-tag ${attributeClass(item.attributes[0])}`}
          key={`${item.letter}-${item.attributes.join("/")}`}
        >
          <strong>{item.letter}</strong>
          {item.attributes.length ? <small>[{item.attributes.join("/")}]</small> : null}
        </span>
      ))}
    </>
  );
}

function DeckCharacterThumb({
  attrClass,
  id,
  imageUrl,
  isRegistered,
  name,
}: {
  attrClass: string;
  id: number;
  imageUrl?: string;
  isRegistered: boolean;
  name: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (imageUrl && !hasError) {
    return (
      <img
        className="deck-character-thumb"
        src={imageUrl}
        alt={name}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <span className={`deck-character-thumb deck-character-placeholder ${attrClass}`}>
      {isRegistered ? name.slice(0, 1) : id}
    </span>
  );
}

export function DeckEditor({ deck, onChange }: DeckEditorProps) {
  function emptySlot(id: number): DeckCharacter {
    return {
      id,
      letters: [],
      letterAttributes: [],
    };
  }

  function updateLetters(id: number, rawValue: string) {
    onChange(
      deck.map((character) => {
        if (character.id !== id) {
          return character;
        }
        const letters = splitLetters(rawValue);
        return {
          ...character,
          letters,
          letterAttributes: normalizeLetterAttributes(character, letters),
        };
      }),
    );
  }

  function clearSlot(id: number) {
    onChange(deck.map((character) => (character.id === id ? emptySlot(id) : character)));
  }

  function saveDeck() {
    window.localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(deck));
  }

  function loadDeck() {
    const saved = window.localStorage.getItem(DECK_STORAGE_KEY);
    if (!saved) {
      return;
    }
    try {
      const parsed = JSON.parse(saved) as DeckCharacter[];
      const normalized = Array.from({ length: 12 }, (_, index) => {
        const id = index + 1;
        const character = parsed.find((item) => item.id === id);
        if (!character) {
          return emptySlot(id);
        }
        const letters = Array.isArray(character.letters) ? character.letters : [];
        const attributes = character.attributes?.length
          ? character.attributes
          : character.attribute
            ? [character.attribute]
            : [];
        return {
          ...character,
          id,
          letters,
          attributes,
          species: character.species ?? character.race,
          letterAttributes: character.letterAttributes?.length
            ? character.letterAttributes
            : letters.map((letter) => ({ letter, attributes })),
        };
      });
      onChange(normalized);
    } catch {
      window.alert("編成データの読み込みに失敗しました。");
    }
  }

  return (
    <section className="section deck-section">
      <div className="section-heading">
        <h2>編成登録</h2>
        <span className="muted">1番枠はリーダー</span>
      </div>
      <div className="actions deck-actions">
        <button onClick={saveDeck}>編成保存</button>
        <button onClick={loadDeck}>編成読み込み</button>
      </div>
      <div className="deck-grid">
        {deck.map((character) => {
          const isLeader = character.id === 1;
          const isRegistered = Boolean(character.name);
          const visibleName = character.name ?? "未登録";
          const attributes = attributesFor(character);
          const primaryAttribute = attributes[0];
          const attrClass = attributes.length > 1 ? "attr-multi" : attributeClass(primaryAttribute);
          const letterAttributes =
            character.letterAttributes?.length ? character.letterAttributes : normalizeLetterAttributes(character);

          return (
            <article className={`deck-card ${attrClass} ${isLeader ? "leader-card" : ""}`} key={character.id}>
              <div className="deck-card-main">
                <DeckCharacterThumb
                  attrClass={attrClass}
                  id={character.id}
                  imageUrl={character.imageUrl}
                  isRegistered={isRegistered}
                  name={visibleName}
                />
                <div className="slot-meta">
                  <span className="slot-number">{character.id}</span>
                  {isLeader ? (
                    <span className="leader-badge">
                      <Crown size={13} aria-hidden />
                      Leader
                    </span>
                  ) : null}
                  {attributes.map((attribute) => (
                    <span className={`attribute-badge ${attributeClass(attribute)}`} key={attribute}>
                      {attribute}
                    </span>
                  ))}
                </div>
                <strong className={isRegistered ? "" : "muted"}>
                  {isLeader && isRegistered ? `リーダー: ${visibleName}` : visibleName}
                </strong>
                <p className="muted">種族: {character.species || character.race || "不明"}</p>
              </div>

              <div className="tag-block">
                <span className="tag-label">持ち文字</span>
                <div className="character-tags">
                  <LetterAttributeTags letters={letterAttributes} />
                </div>
              </div>

              {character.leaderTraits?.length ? (
                <div className="tag-block compact">
                  <span className="tag-label">リーダー特性</span>
                  <div className="character-tags">
                    {character.leaderTraits.slice(0, 3).map((trait) => (
                      <span className="tag muted-tag" key={`${character.id}-${trait}`}>
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {character.gimmicks?.length ? (
                <div className="tag-block compact">
                  <span className="tag-label">ギミック耐性</span>
                  <div className="character-tags">
                    {character.gimmicks.slice(0, 3).map((gimmick) => (
                      <span className="tag muted-tag" key={`${character.id}-${gimmick}`}>
                        {gimmick}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <label className="deck-letter-input">
                <span>持ち文字を手動編集</span>
                <input
                  value={character.letters.join("、")}
                  placeholder="こ、ご、と"
                  onChange={(event) => updateLetters(character.id, event.target.value)}
                />
              </label>
              <button className="compact-button" onClick={() => clearSlot(character.id)}>
                枠クリア
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
