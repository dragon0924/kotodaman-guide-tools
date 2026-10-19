import type { CharacterMove } from "./types";
import type { RecoveryField } from "./characterDetailRecovery";

export type VisibleCharacterSection = { heading: string; rows: string[][] };
export function characterDetailsFromSections(sourceName: string, sections: VisibleCharacterSection[]) {
  const heading = (suffix: string) => sections.filter(section => section.heading === sourceName + suffix);
  const read = (suffix: string) => {
    const matches = heading(suffix);
    if (matches.length > 1) throw new Error(`Ambiguous character section: ${sourceName}${suffix}`);
    return matches[0];
  };
  const lines = (section: VisibleCharacterSection | undefined) => (section?.rows ?? []).flatMap(row => row.flatMap(cell => cell.split(/\r?\n/u))).map(line => line.trim()).filter(line => line && !/^効果(?:[（(].*[）)])?$/u.test(line));
  const trait = (suffix: string) => {
    const values = lines(read(suffix));
    return values.length && !values.every(value => value === "なし") ? values : undefined;
  };
  const moveSection = read("のわざ・すごわざ");
  // The source has two tables in order: ordinary move, then super move.
  // Keep a whole cell together; line filters used for headings can discard valid effects.
  const moves = (moveSection?.rows ?? []).flatMap(row => row).filter(cell => /^【/u.test(cell.trim()));
  const parseMove = (cell: string | undefined): CharacterMove | undefined => {
    const match = cell?.trim().match(/^(【[\s\S]+?】)\s*([\s\S]+)$/u);
    return match && match[2].trim() !== "なし" ? { condition: match[1], effect: match[2].trim() } : undefined;
  };
  const fields = {
    leaderTraitText: trait("のリーダー特性")?.join("\n"),
    normalMove: moves.length === 2 ? parseMove(moves[0]) : undefined,
    superMove: moves.length === 2 ? parseMove(moves[1]) : undefined,
    traitsRaw: trait("の特性"),
    blessingTraitsRaw: trait("の祝福特性"),
  };
  const sectionHeadings: Partial<Record<RecoveryField, string>> = {};
  for (const field of Object.keys(fields) as RecoveryField[]) {
    if (fields[field] === undefined) continue;
    const suffix = field === "traitsRaw" ? "の特性" : field === "blessingTraitsRaw" ? "の祝福特性" : field === "leaderTraitText" ? "のリーダー特性" : "のわざ・すごわざ";
    sectionHeadings[field] = sourceName + suffix;
  }
  return { fields, sectionHeadings };
}
