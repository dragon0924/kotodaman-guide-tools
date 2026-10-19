import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { SpecialRarityBadge } from "@/components/SpecialRarityBadge";
import { getCharacterById } from "@/lib/characterStore";
import { combinedGimmickDisplayList } from "@/lib/gimmicks";
import { getGroupDisplayMap, readGroupOrder } from "@/lib/groupOrder";
import { displayMoveConditions } from "@/lib/moveConditions";
import { readQuests } from "@/lib/questStore";
import { explicitlyNoTraits, statusDisplayEntries } from "@/lib/characterDetailDisplay";
import type {
  CharacterStatus,
  CharacterKotowaza,
  CharacterLetter,
  CharacterMove,
  CharacterSearchResult,
  CharacterSkill,
  MoveCondition,
  QuestRecord,
} from "@/lib/types";

type CharacterDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

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

const LETTER_ATTRIBUTE_COLORS: Record<string, string> = {
  火: "#e74c3c",
  水: "#3498db",
  木: "#27ae60",
  光: "#f1c40f",
  闇: "#8e44ad",
  天: "#bff7ff",
  冥: "#2c3e50",
};

function letterAttributeStyle(attributes: string[]): CSSProperties | undefined {
  if (attributes.includes("虹")) {
    return {
      "--letter-attr-bg": "linear-gradient(135deg, #e74c3c 0%, #f39c12 20%, #f1c40f 36%, #27ae60 54%, #3498db 72%, #8e44ad 88%, #e74c3c 100%)",
    } as CSSProperties;
  }
  const colors = Array.from(new Set(attributes.map((attribute) => LETTER_ATTRIBUTE_COLORS[attribute]).filter(Boolean)));
  if (!colors.length) {
    return undefined;
  }
  return {
    "--letter-attr-bg": colors.length === 1
      ? `linear-gradient(${colors[0]}, ${colors[0]})`
      : `linear-gradient(135deg, ${colors.join(", ")})`,
  } as CSSProperties;
}

function speciesShortName(value?: string) {
  const text = String(value ?? "").trim();
  if (!text || text.includes("不明")) return "?";
  if (text.includes("英雄") || text === "英" || text.includes("英種族")) return "英";
  if (text.includes("龍") || text.includes("竜")) return "龍";
  if (text.includes("神")) return "神";
  if (text.includes("物")) return "物";
  if (text.includes("獣")) return "獣";
  if (text.includes("霊")) return "霊";
  if (text.includes("魔")) return "魔";
  if (text.includes("妖")) return "妖";
  return text.slice(0, 1);
}

function DetailTags({ items, empty = "未登録" }: { items?: string[]; empty?: string }) {
  const values = items?.filter(Boolean) ?? [];
  if (!values.length) {
    return <span className="muted">{empty}</span>;
  }
  return (
    <div className="character-tags">
      {values.map((item) => (
        <span className="tag muted-tag" key={item}>
          {item}
        </span>
      ))}
    </div>
  );
}

const NUMBERED_EFFECT_MARKERS = new Set("①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳");
const NUMBERED_EFFECT_START = /^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/;

function splitNumberedEffectText(value: string) {
  const segments: string[] = [];
  let segmentStart = 0;
  let bracketDepth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "【") {
      bracketDepth += 1;
      continue;
    }
    if (character === "】") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }
    if (bracketDepth === 0 && NUMBERED_EFFECT_MARKERS.has(character) && index > segmentStart) {
      segments.push(value.slice(segmentStart, index));
      segmentStart = index;
    }
  }

  segments.push(value.slice(segmentStart));
  return segments;
}

function splitDisplayText(value?: string) {
  if (!value) {
    return [];
  }
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .flatMap(splitNumberedEffectText)
    .map((line) => line.trim().replace(/^[・●•\s]+/, "").trim())
    .map((line) => (line === "効果" ? "" : line))
    .map((line) => line.replace(/^効果(?:\s*[:：]\s*|\s+)/, "").trim())
    .filter(Boolean);
}

function LabeledText({ label, value }: { label: string; value?: string }) {
  const lines = splitDisplayText(value);
  if (!lines.length) {
    return null;
  }
  return (
    <div className="move-inline-row">
      <strong>{label}：</strong>
      <div className="formatted-effect-lines">
        {lines.map((line, index) => (
          <span key={`${index}-${line}`}>{line}</span>
        ))}
      </div>
    </div>
  );
}

function FormattedText({ value }: { value: string }) {
  const lines = splitDisplayText(value);
  return (
    <div className="leader-trait-text">
      {lines.map((line, index) => (
        <p key={`${index}-${line}`}>{line}</p>
      ))}
    </div>
  );
}

function FormattedTraits({ items }: { items: string[] }) {
  const lines = items.flatMap(splitDisplayText);
  if (!lines.length) {
    return <span className="muted">未登録</span>;
  }
  return (
    <ul className="trait-list formatted-trait-list">
      {lines.map((line, index) => (
        <li className={NUMBERED_EFFECT_START.test(line) ? "numbered-effect" : undefined} key={`${index}-${line}`}>
          {line}
        </li>
      ))}
    </ul>
  );
}

function MoveContent({ move }: { move?: CharacterMove }) {
  if (!move?.condition && !move?.conditions?.length && !move?.effect) {
    return <p className="muted">未登録</p>;
  }
  return (
    <>
      <ConditionList conditions={move.conditions ?? []} legacyCondition={move.condition} />
      <LabeledText label="効果" value={move.effect} />
    </>
  );
}

function MoveTabs({
  id,
  normalMove,
  superMove,
  kotowaza,
}: {
  id: string;
  normalMove?: CharacterMove;
  superMove?: CharacterMove;
  kotowaza?: CharacterKotowaza[];
}) {
  const groupName = `move-tabs-${id}`;
  const normalId = `${groupName}-normal`;
  const superId = `${groupName}-super`;
  const kotowazaId = `${groupName}-kotowaza`;
  const hasKotowaza = Boolean(kotowaza?.length);

  return (
    <section className="character-detail-info-card wide move-tabs-card" aria-label="わざ・すごわざ">
      <div className="move-tab-controls" role="tablist" aria-label="わざ切り替え">
        <input className="move-tab-input" defaultChecked id={normalId} name={groupName} type="radio" />
        <label className="move-tab-button normal-tab" htmlFor={normalId}>
          わざ
        </label>
        <input className="move-tab-input" id={superId} name={groupName} type="radio" />
        <label className="move-tab-button super-tab" htmlFor={superId}>
          すごわざ
        </label>
        {hasKotowaza ? (
          <>
            <input className="move-tab-input" id={kotowazaId} name={groupName} type="radio" />
            <label className="move-tab-button kotowaza-tab" htmlFor={kotowazaId}>
              ことわざ
            </label>
          </>
        ) : null}
        <div className="move-tab-panel normal-panel" role="tabpanel">
          <MoveContent move={normalMove} />
        </div>
        <div className="move-tab-panel super-panel" role="tabpanel">
          <MoveContent move={superMove} />
        </div>
        {hasKotowaza ? (
          <div className="move-tab-panel kotowaza-panel" role="tabpanel">
            <div className="kotowaza-list">
              {kotowaza!.map((item) => (
                <div className="kotowaza-detail-row" key={item.level}>
                  <strong>
                    {item.level === 0 ? "無凸" : item.level === 4 ? "4凸 / MAX" : `${item.level}凸`}
                  </strong>
                  <div className="kotowaza-detail-content">
                    <ConditionList conditions={item.conditions} legacyCondition={item.condition} />
                    <LabeledText label="効果" value={item.effect} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SkillDetailCard({
  title,
  skill,
}: {
  title: string;
  skill?: CharacterSkill;
}) {
  const lines = skillDisplayLines(skill);
  if (!lines.length) {
    return null;
  }
  return (
    <div className="character-detail-info-card">
      <h2>{title}</h2>
      <div className="skill-detail-lines">
        {lines.map((line) => (
          <p key={line.key}>{line.emphasize ? <strong>{line.text}</strong> : line.text}</p>
        ))}
      </div>
    </div>
  );
}

function skillDisplayLines(skill?: CharacterSkill) {
  const candidates = [
    { value: skill?.name, emphasize: true },
    { value: skill?.summary, emphasize: false },
    { value: skill?.effect, emphasize: false },
  ];
  const seen = new Set<string>();
  const lines: Array<{ key: string; text: string; emphasize: boolean }> = [];

  for (const candidate of candidates) {
    for (const text of splitDisplayText(candidate.value)) {
      const normalized = text.normalize("NFKC").replace(/\s+/g, " ").trim();
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      lines.push({
        key: `${lines.length}-${normalized}`,
        text,
        emphasize: candidate.emphasize,
      });
    }
  }
  return lines;
}

function hasSkill(skill?: CharacterSkill) {
  return skillDisplayLines(skill).length > 0;
}

function StatusDetailCard({ status }: { status?: CharacterStatus }) {
  const entries = statusDisplayEntries(status);
  const raw = status?.raw?.filter(line => line.trim()) ?? [];
  if (!entries.length && !raw.length) return null;
  return (
    <section className="character-detail-info-card wide">
      <h2>ステータス</h2>
      {entries.length ? <dl className="character-status-values">
        {entries.map(entry => <div key={entry.key}><dt>{entry.label}</dt><dd>{entry.value.toLocaleString("ja-JP")}</dd></div>)}
      </dl> : null}
      {raw.length ? <details className="character-status-source"><summary>ステータス表</summary><pre>{raw.join("\n")}</pre></details> : null}
    </section>
  );
}

function QuestList({
  title,
  quests,
}: {
  title: string;
  quests: QuestRecord[];
}) {
  if (!quests.length) {
    return null;
  }
  return (
    <section className="character-review-card">
      <h2>{title}</h2>
      <ul>
        {quests.map((quest) => (
          <li key={quest.questId}>
            <strong>{quest.questName}</strong>
            {quest.questType ? <span> / {quest.questType}</span> : null}
            {quest.difficulty ? <span> / {quest.difficulty}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function RelatedCharacters({ characters }: { characters: CharacterSearchResult[] }) {
  if (!characters.length) {
    return null;
  }
  return (
    <div className="character-detail-info-card wide">
      <h2>関連コトダマン</h2>
      <div className="related-character-grid">
        {characters.map((character) => {
          const attributes = character.attributes?.length ? character.attributes : [character.attribute].filter(Boolean);
          return (
            <Link className="related-character-card" href={`/characters/${encodeURIComponent(character.id)}`} key={character.id}>
              <div className="related-character-image">
                {character.imageUrl ? (
                  <img alt={character.name} src={character.imageUrl} referrerPolicy="no-referrer" />
                ) : (
                  <span>{character.name.slice(0, 1)}</span>
                )}
              </div>
              <div>
                <strong>{character.name}</strong>
                <div className="character-tags">
                  {attributes.map((attribute) => (
                    <span className={`attribute-badge ${attributeClass(attribute)}`} key={attribute}>
                      {attribute}
                    </span>
                  ))}
                  <span className="species-badge" title={character.species || character.race || "不明"}>
                    {speciesShortName(character.species || character.race)}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ConditionList({
  conditions,
  legacyCondition,
}: {
  conditions?: MoveCondition[];
  legacyCondition?: string;
}) {
  const uniqueValues = displayMoveConditions(conditions, legacyCondition);
  if (!uniqueValues.length) {
    return <p className="muted">条件未登録</p>;
  }
  return (
    <div className="move-condition-display">
      <strong>条件：</strong>
      <span>{uniqueValues.join(" or ")}</span>
    </div>
  );
}

function LetterTags({ letters }: { letters?: CharacterLetter[] }) {
  if (!letters?.length) {
    return <span className="muted">未登録</span>;
  }
  return (
    <div className="character-tags">
      {letters.map((item) => (
        <span
          className={`tag letter-attribute-tag ${item.attributes.length > 1 ? "attr-multi" : attributeClass(item.attributes[0])}`}
          key={`${item.letter}-${item.attributes.join("/")}`}
          style={letterAttributeStyle(item.attributes)}
          title={`${item.letter}：${item.attributes.join(" / ") || "属性不明"}`}
        >
          <strong>{item.letter}</strong>
          {item.attributes.length ? <small>[{item.attributes.join("/")}]</small> : null}
        </span>
      ))}
    </div>
  );
}

function ReviewSection({
  title,
  value,
  placeholder,
}: {
  title: string;
  value?: string | string[];
  placeholder: string;
}) {
  const values = Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
  return (
    <section className="character-review-card">
      <h2>{title}</h2>
      {values.length ? (
        <ul>
          {values.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">{placeholder}</p>
      )}
    </section>
  );
}

function readLegacyReview(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    const record = value as { rating?: string; summary?: string; memo?: string; recommendedQuests?: string[] };
    return record.rating ?? record.summary ?? "";
  }
  return "";
}

export default async function CharacterDetailPage({ params }: CharacterDetailPageProps) {
  const { id } = await params;
  const [character, groupOrder, questFile] = await Promise.all([getCharacterById(id), readGroupOrder(), readQuests()]);

  if (!character) {
    notFound();
  }

  const attributes = character.attributes?.length ? character.attributes : [character.attribute].filter(Boolean);
  const groupDisplayMap = getGroupDisplayMap(groupOrder);
  const groups = [
    ...(character.groups ?? []).map((group) => groupDisplayMap.groups[group] ?? group),
    ...(character.collabGroups ?? []).map((group) => groupDisplayMap.collabGroups[group] ?? group),
  ];
  const reviewText = readLegacyReview(character.review);
  const questById = new globalThis.Map(questFile.quests.map((quest) => [quest.questId, quest]));
  const obtainedQuests = (character.obtainedQuestIds ?? [])
    .map((questId) => questById.get(questId))
    .filter((quest): quest is QuestRecord => Boolean(quest));
  const recommendedQuestRecords = (character.recommendedQuestIds ?? [])
    .map((questId) => questById.get(questId))
    .filter((quest): quest is QuestRecord => Boolean(quest));
  const relatedIds = Array.from(new Set([
    ...(character.relatedCharacters ?? []).map((item) => item.characterId),
    ...(character.relatedCharacterIds ?? []),
  ].filter(Boolean)));
  const relatedCharacters = (await Promise.all(
    relatedIds
      .filter((relatedId) => relatedId !== character.id)
      .map((relatedId) => getCharacterById(relatedId)),
  )).filter((item): item is CharacterSearchResult => Boolean(item));

  return (
    <>
        <div className="tab-title-row">
          <h2>キャラクター詳細</h2>
        </div>

        <div className="character-detail-page">
          <div className="character-detail-topbar">
            <Link href="/characters">キャラ検索に戻る</Link>
          </div>

          <section className="character-detail-hero with-profile-details">
            <div className="character-detail-image">
              {character.imageUrl ? (
                <img alt={character.name} src={character.imageUrl} referrerPolicy="no-referrer" />
              ) : (
                <span>{character.name.slice(0, 1)}</span>
              )}
            </div>
            <div className="character-detail-title">
              <h1>{character.name}</h1>
              <div className="character-meta-line">
                {attributes.map((attribute) => (
                  <span className={`attribute-badge ${attributeClass(attribute)}`} key={attribute}>
                    {attribute}
                  </span>
                ))}
                <span className="species-badge" title={character.species || character.race || "不明"}>
                  {speciesShortName(character.species || character.race)}
                </span>
                <SpecialRarityBadge rarity={character.rarityType} />
              </div>
              {groups.length ? (
                <div className="character-profile-groups" aria-label="グループ">
                  {groups.map((group) => (
                    <span className="tag profile-group-tag" key={group}>
                      {group}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="character-profile-details">
              <div className="profile-detail-block">
                <h2>持ち文字</h2>
                <LetterTags letters={character.letterAttributes} />
              </div>
              <div className="profile-detail-block">
                <h2>ギミック耐性</h2>
                <DetailTags items={combinedGimmickDisplayList(character.gimmicks ?? [], character.superGimmicks ?? [])} />
              </div>
            </div>
          </section>

          <section className="section character-detail-grid-page">
            <MoveTabs
              id={character.id}
              normalMove={character.normalMove}
              superMove={character.superMove}
              kotowaza={character.kotowaza}
            />
            <div className="character-detail-info-card wide">
              <h2>リーダー特性</h2>
              {character.leaderTraitText ? <FormattedText value={character.leaderTraitText} /> : <DetailTags items={character.leaderTraits} />}
              {character.leaderTraitText && character.leaderTraits?.length ? <DetailTags items={character.leaderTraits} /> : null}
            </div>
            <div className="character-detail-info-card wide">
              <h2>とくせい</h2>
              {(character.renderedTraits?.length || character.traits?.length) ? (
                <FormattedTraits
                  items={character.renderedTraits?.length ? character.renderedTraits : (character.traits ?? []).map(String)}
                />
              ) : (
                <span className="muted">{explicitlyNoTraits(character.traitsRaw) ? "とくせいなし" : "未登録"}</span>
              )}
            </div>
            {character.renderedBlessingTraits?.length ? (
              <section className="character-detail-info-card wide">
                <h2>祝福特性</h2>
                <FormattedTraits items={character.renderedBlessingTraits} />
              </section>
            ) : null}
            <StatusDetailCard status={character.status} />
            {hasSkill(character.exSkill) || hasSkill(character.chargeSkill) ? (
              <div className="character-detail-skill-grid">
                <SkillDetailCard title="EXスキル" skill={character.exSkill} />
                <SkillDetailCard title="チャージスキル" skill={character.chargeSkill} />
              </div>
            ) : null}
            <RelatedCharacters characters={relatedCharacters} />
          </section>

          <section className="character-review-grid">
            <ReviewSection title="評価" value={reviewText} placeholder="未登録" />
            <ReviewSection title="適正降臨クエスト" value={character.recommendedQuests} placeholder="未登録" />
            <QuestList title="入手方法" quests={obtainedQuests} />
            <QuestList title="適正クエスト" quests={recommendedQuestRecords} />
            <ReviewSection title="補足情報" value={character.memo} placeholder="未登録" />
          </section>
        </div>
    </>
  );
}
