import type { CharacterRecord, CharacterDetailCandidate, CharacterLetter, CharacterSkill } from "./types";
import { normalizeGimmickList, normalizeSuperGimmickList, normalizeSuperGimmickName } from "./gimmicks.ts";

export function completeNewCandidateFromVisibleSections(candidate: CharacterDetailCandidate, sections: Array<{heading:string;rows:string[][]}>) {
  const completed={...candidate,rawSections:candidate.rawSections?.map(section=>({...section}))};
  // Only explicitly bounded trait tables are used. Do not apply broad line/noise filters to effect text.
  for(const [suffix,field,title] of [["の特性","traitsRaw","とくせい"],["の祝福特性","blessingTraitsRaw","祝福特性"]] as const) {
    const section=sections.find(s=>s.heading===candidate.name+suffix);
    if(!section)continue;
    const lines=section.rows.filter(row=>!(row.length===1&&/^効果(?:[（(].*[）)])?$/u.test(row[0]))).flatMap(row=>row.flatMap(cell=>cell.split(/\r?\n/u).map(line=>line.trim()).filter(Boolean)));
    if(!lines.length)continue;
    completed[field]=lines;
    const raw=completed.rawSections?.find(s=>s.title===title);
    if(raw)raw.text=lines.join("\n");
  }
  return completed;
}

export function explicitLetterAttributes(character: CharacterRecord, text: string): CharacterLetter[] {
  const letters = new Set(character.letters);
  // The list supplies main letters; explicit transformation text adds omitted small/voiced letters.
  for (const match of text.matchAll(/(?<!サブ属性)文字変換(?:に)?「([^」]+)」/gu)) {
    for (const letter of match[1].split("・")) if (/^[ぁ-ゖー]$/u.test(letter)) letters.add(letter);
  }
  const mappings = new Map(Array.from(letters, letter => [letter, new Set([character.attribute])]));
  const add = (value: string, attribute: string) => {
    for (const letter of value.split("・")) {
      if (!/^[ぁ-ゖー]$/u.test(letter)) throw new Error(`Unrecognized letter: ${letter}`);
      const attributes = mappings.get(letter) ?? new Set<string>();
      attributes.add(attribute); mappings.set(letter, attributes);
    }
  };
  for (const match of text.matchAll(/サブ属性文字変換「([^」]+)」[（(]([火水木光闇天冥])[）)]/gu)) add(match[1], match[2]);
  for (const match of text.matchAll(/サブ属性として([火水木光闇天冥])属性の文字「([^」]+)」/gu)) add(match[2], match[1]);
  for (const match of text.matchAll(/サブ属性文字変換[（(]([火水木光闇天冥])[）)]が追加[^\n]+/gu)) {
    for (const quoted of match[0].matchAll(/「([ぁ-ゖー・]+)」/gu)) add(quoted[1],match[1]);
  }
  return Array.from(mappings, ([letter, attributes]) => ({letter,attributes:[...attributes]}));
}

export function extractNewKotowaza(name: string, text: string) {
  const start = text.indexOf(`${name}のコトわざ\n`);
  if (start < 0) return {unresolved: "コトわざの本文なし"};
  const section = text.slice(start + `${name}のコトわざ\n`.length).split(/\n(?:特性\/|※)/u)[0].trim();
  if (section === "なし") return {coverage: "none" as const};
  const match = section.match(/^【([\s\S]+?)】\s*([\s\S]+)$/u);
  if (!match || !text.slice(start).includes("※最大時の情報を記載しています。")) return {unresolved: "コトわざのレベル・条件を確定できない"};
  return {coverage: "max_only" as const,kotowaza:[{level:4 as const,condition:`【${match[1]}】`,effect:match[2].trim()}]};
}

export function extractNewSkill(name: string, text: string, kind: "EXスキル" | "チャージスキル"): CharacterSkill | undefined {
  const heading = `${name}の${kind}\n`;
  const start = text.indexOf(heading);
  if (start < 0) return undefined;
  const endHeading = kind === "EXスキル" ? `${name}のチャージスキル` : `${name}のコトバースト`;
  const section = text.slice(start + heading.length).split(endHeading)[0].split(`${name}の祝福特性`)[0];
  const lines = section.split(/\r?\n/u).map(line => line.trim()).filter(line => line && line !== "効果");
  if (!lines.length || lines[0] === "なし") return undefined;
  if (kind === "チャージスキル" && lines.length > 1) return {name:lines[0],effect:lines.slice(1).join("\n")};
  return {effect:lines.join("\n")};
}

export function newCharacterFromSnapshot(character: CharacterRecord, candidate: CharacterDetailCandidate, species: string, snapshot: {text: string; images: Array<{src: string; alt: string}>}) {
  const image = snapshot.images.find(img => img.alt === character.name && /^https:\/\/img\.gamewith\.jp\/article_tools\/kotodaman\/gacha\/\d+\.png(?:\?.*)?$/.test(img.src));
  if (!image) throw new Error(`No unambiguous visible character image: ${character.name}`);
  const traitText = snapshot.text.split(`${character.name}の特性\n`)[1]?.split(`${character.name}のEXスキル`)[0] ?? "";
  const blessingText = snapshot.text.split(`${character.name}の祝福特性\n`)[1]?.split("コトダマン関連リンク")[0] ?? "";
  const letterAttributes = explicitLetterAttributes(character, `${traitText}\n${blessingText}`);
  const kotowaza = extractNewKotowaza(character.name,snapshot.text);
  const c: CharacterRecord = {
    ...character, species, race: species, imageUrl:image.src, imageSourceUrl:character.sourceUrl,
    letters:letterAttributes.map(m=>m.letter),letterAttributes,
    attributes:[...new Set(letterAttributes.flatMap(m=>m.attributes))],
    gimmicks:normalizeGimmickList(character.gimmicks.filter(g=>!normalizeSuperGimmickName(g))),
    superGimmicks:normalizeSuperGimmickList(character.gimmicks),
  };
  for (const field of ["leaderTraitText","normalMove","superMove","traitsRaw","blessingTraitsRaw","status"] as const) {
    const value=candidate[field];
    if (value !== undefined && (!Array.isArray(value)||value.length) && !(typeof value === "object" && "effect" in value && value.effect === "なし")) Object.assign(c,{[field]:value});
  }
  const exSkill = extractNewSkill(character.name, snapshot.text, "EXスキル");
  const chargeSkill = extractNewSkill(character.name, snapshot.text, "チャージスキル");
  if (exSkill) c.exSkill = exSkill;
  if (chargeSkill) c.chargeSkill = chargeSkill;
  if (kotowaza.kotowaza) c.kotowaza=kotowaza.kotowaza;
  return {character:c,kotowaza};
}
