import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeTraitTemplate } from "./traits";
import type { TraitMasterFile, TraitTemplate } from "./types";

const TRAIT_MASTER_PATH = path.join(process.cwd(), "data", "traitMaster.json");

export async function traitMasterMtime() {
  try {
    return String((await stat(TRAIT_MASTER_PATH)).mtimeMs);
  } catch {
    return "missing";
  }
}

export async function readTraitMaster(): Promise<TraitMasterFile> {
  try {
    const payload = await readFile(TRAIT_MASTER_PATH, "utf8");
    const parsed = JSON.parse(payload) as TraitMasterFile;
    const templates = Array.isArray(parsed.templates)
      ? parsed.templates
          .map(normalizeTraitTemplate)
          .filter((template): template is TraitTemplate => Boolean(template))
      : [];
    return {
      meta: parsed.meta ?? {},
      templates,
    };
  } catch {
    return {
      meta: {
        updatedAt: null,
      },
      templates: [],
    };
  }
}

export async function writeTraitMaster(file: TraitMasterFile) {
  await mkdir(path.dirname(TRAIT_MASTER_PATH), { recursive: true });
  await writeFile(TRAIT_MASTER_PATH, `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

export function traitMasterRelativePath() {
  return "data/traitMaster.json";
}
