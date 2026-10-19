import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type GroupOrderEntry = {
  name: string;
  displayName?: string;
  firstHeldAt?: string;
  order?: number;
};

export type GroupOrderFile = {
  collabGroups: GroupOrderEntry[];
  groups: GroupOrderEntry[];
};

export type GroupKind = keyof GroupOrderFile;

export const GROUP_ORDER_PATH = path.join(process.cwd(), "data", "groupOrder.json");

function normalizeName(value: string) {
  return value.normalize("NFKC").trim();
}

function normalizeDate(value: unknown) {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function normalizeOrder(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function normalizeDisplayName(value: unknown, fallback: string) {
  const text = String(value ?? "").normalize("NFKC").trim();
  return text || fallback;
}

function uniqueEntries(entries: unknown): GroupOrderEntry[] {
  if (!Array.isArray(entries)) {
    return [];
  }
  const byName = new Map<string, GroupOrderEntry>();
  for (const item of entries) {
    const record = item as Partial<GroupOrderEntry>;
    const name = normalizeName(String(record.name ?? ""));
    if (!name) {
      continue;
    }
    byName.set(name, {
      name,
      displayName: normalizeDisplayName(record.displayName, name),
      firstHeldAt: normalizeDate(record.firstHeldAt) || undefined,
      order: normalizeOrder(record.order),
    });
  }
  return Array.from(byName.values());
}

export function normalizeGroupOrderFile(value: unknown): GroupOrderFile {
  const record = (value ?? {}) as Partial<GroupOrderFile>;
  return {
    collabGroups: uniqueEntries(record.collabGroups),
    groups: uniqueEntries(record.groups),
  };
}

export async function groupOrderMtime() {
  try {
    return String((await stat(GROUP_ORDER_PATH)).mtimeMs);
  } catch {
    return "missing";
  }
}

export async function readGroupOrder(): Promise<GroupOrderFile> {
  try {
    const payload = await readFile(GROUP_ORDER_PATH, "utf8");
    return normalizeGroupOrderFile(JSON.parse(payload));
  } catch {
    return {
      collabGroups: [],
      groups: [],
    };
  }
}

export async function writeGroupOrder(file: GroupOrderFile) {
  await mkdir(path.dirname(GROUP_ORDER_PATH), { recursive: true });
  await writeFile(GROUP_ORDER_PATH, `${JSON.stringify(normalizeGroupOrderFile(file), null, 2)}\n`, "utf8");
}

export function mergeDetectedGroupOrder(
  current: GroupOrderFile,
  detectedGroups: string[],
  detectedCollabGroups: string[],
) {
  return {
    groups: mergeEntries(current.groups, detectedGroups),
    collabGroups: mergeEntries(current.collabGroups, detectedCollabGroups),
  };
}

function mergeEntries(current: GroupOrderEntry[], detected: string[]) {
  const existing = new Map(current.map((entry) => [normalizeName(entry.name), entry]));
  const merged = [...current];
  for (const name of detected.map(normalizeName).filter(Boolean)) {
    if (!existing.has(name)) {
      merged.push({
        name,
        displayName: undefined,
        firstHeldAt: undefined,
        order: undefined,
      });
    }
  }
  return merged;
}

export function sortGroupsByOrder(names: string[], entries: GroupOrderEntry[], kind: GroupKind) {
  const orderByName = new Map(entries.map((entry) => [normalizeName(entry.name), entry]));
  return [...names].sort((a, b) => compareGroupNames(a, b, orderByName, kind));
}

export function getGroupDisplayName(name: string, entries: GroupOrderEntry[] = []) {
  const normalized = normalizeName(name);
  const entry = entries.find((item) => normalizeName(item.name) === normalized);
  return entry?.displayName || entry?.name || name;
}

export function getGroupDisplayMap(groupOrder: GroupOrderFile) {
  return {
    groups: Object.fromEntries(groupOrder.groups.map((entry) => [entry.name, entry.displayName || entry.name])),
    collabGroups: Object.fromEntries(groupOrder.collabGroups.map((entry) => [entry.name, entry.displayName || entry.name])),
  };
}

export function findOrphanGroupEntries(entries: GroupOrderEntry[], detectedNames: string[]) {
  const detected = new Set(detectedNames.map(normalizeName));
  return entries.filter((entry) => !detected.has(normalizeName(entry.name))).map((entry) => entry.name);
}

function compareGroupNames(
  a: string,
  b: string,
  orderByName: Map<string, GroupOrderEntry>,
  kind: GroupKind,
) {
  const aEntry = orderByName.get(normalizeName(a));
  const bEntry = orderByName.get(normalizeName(b));
  const aRegistered = Boolean(aEntry);
  const bRegistered = Boolean(bEntry);
  if (aRegistered !== bRegistered) {
    return aRegistered ? -1 : 1;
  }

  if (kind === "collabGroups") {
    const aDate = aEntry?.firstHeldAt ?? "";
    const bDate = bEntry?.firstHeldAt ?? "";
    const aHasDate = Boolean(aDate);
    const bHasDate = Boolean(bDate);
    if (aHasDate !== bHasDate) {
      return aHasDate ? -1 : 1;
    }
    if (aDate && bDate && aDate !== bDate) {
      return aDate.localeCompare(bDate);
    }
  }

  const aOrder = aEntry?.order;
  const bOrder = bEntry?.order;
  const aHasOrder = typeof aOrder === "number";
  const bHasOrder = typeof bOrder === "number";
  if (aHasOrder !== bHasOrder) {
    return aHasOrder ? -1 : 1;
  }
  if (aHasOrder && bHasOrder && aOrder !== bOrder) {
    return aOrder - bOrder;
  }

  return a.localeCompare(b, "ja");
}
