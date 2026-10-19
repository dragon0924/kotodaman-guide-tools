import type { CharacterTrait, CharacterTraitEntry, TraitTemplate } from "./types";

export const TRAIT_PARAM_TYPES = ["text", "number", "attribute", "species", "letter", "gimmick", "condition"] as const;

export function normalizeTraitTemplate(value: unknown): TraitTemplate | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Partial<TraitTemplate>;
  const id = String(record.id ?? "").trim();
  const name = String(record.name ?? "").trim();
  const template = String(record.template ?? "").trim();
  if (!id || !name || !template) {
    return null;
  }
  const params: TraitTemplate["params"] = [];
  if (Array.isArray(record.params)) {
    for (const param of record.params) {
      const item = param as TraitTemplate["params"][number];
      const key = String(item.key ?? "").trim();
      const label = String(item.label ?? "").trim();
      const type = String(item.type ?? "text") as TraitTemplate["params"][number]["type"];
      if (!key || !label || !TRAIT_PARAM_TYPES.includes(type)) {
        continue;
      }
      params.push({
        key,
        label,
        type,
        required: Boolean(item.required),
      });
    }
  }
  const category = String(record.category ?? "").trim();
  const sourceType = record.sourceType === "trait" || record.sourceType === "blessingTrait"
    ? record.sourceType
    : undefined;
  const pattern = String(record.pattern ?? "").trim();
  const paramKeys = Array.isArray(record.paramKeys)
    ? Array.from(new Set(record.paramKeys.map((key) => String(key ?? "").trim()).filter(Boolean)))
    : undefined;
  const examples = Array.isArray(record.examples)
    ? Array.from(new Set(record.examples.map((example) => String(example ?? "").trim()).filter(Boolean)))
    : undefined;
  const description = String(record.description ?? "").trim();
  return {
    id,
    name,
    template,
    params,
    ...(category ? { category } : {}),
    ...(sourceType ? { sourceType } : {}),
    ...(pattern ? { pattern } : {}),
    ...(paramKeys?.length ? { paramKeys } : {}),
    ...(examples?.length ? { examples } : {}),
    ...(description ? { description } : {}),
    ...(typeof record.isActive === "boolean" ? { isActive: record.isActive } : {}),
  };
}

export function normalizeTraitEntry(value: unknown): CharacterTraitEntry | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text ? text : null;
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Partial<CharacterTrait>;
  const templateId = String(record.templateId ?? "").trim();
  if (!templateId) {
    return null;
  }
  const values: Record<string, string | number> = {};
  if (record.values && typeof record.values === "object") {
    for (const [key, rawValue] of Object.entries(record.values)) {
      if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
        values[key] = rawValue;
      } else {
        const text = String(rawValue ?? "").trim();
        if (text) {
          values[key] = text;
        }
      }
    }
  }
  const note = String(record.note ?? "").trim();
  return {
    templateId,
    values,
    note: note || undefined,
  };
}

export function normalizeTraitEntries(value: unknown): CharacterTraitEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(normalizeTraitEntry)
    .filter((trait): trait is CharacterTraitEntry => Boolean(trait));
}

export function renderTrait(trait: CharacterTraitEntry, templates: TraitTemplate[] = []) {
  if (typeof trait === "string") {
    return trait;
  }
  const template = templates.find((item) => item.id === trait.templateId);
  if (!template) {
    return trait.note || trait.templateId;
  }
  const rendered = template.template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = trait.values?.[key];
    return value === undefined || value === null || value === "" ? `{${key}}` : String(value);
  });
  return trait.note ? `${rendered}（${trait.note}）` : rendered;
}

export function traitTemplateName(trait: CharacterTraitEntry, templates: TraitTemplate[] = []) {
  if (typeof trait === "string") {
    return trait;
  }
  const template = templates.find((item) => item.id === trait.templateId);
  return template?.name || trait.templateId;
}

export function traitTemplateNames(traits: CharacterTraitEntry[] = [], templates: TraitTemplate[] = []) {
  return Array.from(new Set(traits.map((trait) => traitTemplateName(trait, templates)).filter(Boolean)));
}

export function traitSearchText(traits: CharacterTraitEntry[] = [], templates: TraitTemplate[] = []) {
  return traits
    .flatMap((trait) => {
      if (typeof trait === "string") {
        return [trait];
      }
      const template = templates.find((item) => item.id === trait.templateId);
      return [
        trait.templateId,
        template?.name ?? "",
        renderTrait(trait, templates),
        ...Object.values(trait.values ?? {}).map(String),
        trait.note ?? "",
      ];
    })
    .join(" ");
}
