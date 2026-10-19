import { isAdminRequest } from "@/lib/server/adminAuth";
import { NextRequest, NextResponse } from "next/server";
import { clearCharacterCache, getCharacterMeta } from "@/lib/characterStore";
import {
  findOrphanGroupEntries,
  mergeDetectedGroupOrder,
  normalizeGroupOrderFile,
  readGroupOrder,
  writeGroupOrder,
} from "@/lib/groupOrder";
import type { GroupOrderFile } from "@/lib/groupOrder";

function unauthorized() {
  return new NextResponse("Unauthorized", { status: 401 });
}

function assertAdmin(request: NextRequest) {
  return isAdminRequest(request);
}

function splitDetectedGroups(meta: Awaited<ReturnType<typeof getCharacterMeta>>) {
  const collabGroups = meta.collabGroupOptions ?? [];
  const collabSet = new Set(collabGroups);
  const groups = (meta.groupOptions ?? []).filter((group) => !collabSet.has(group));
  return { groups, collabGroups };
}

export async function GET(request: NextRequest) {
  if (!assertAdmin(request)) {
    return unauthorized();
  }

  const [current, meta] = await Promise.all([readGroupOrder(), getCharacterMeta(true)]);
  const detected = splitDetectedGroups(meta);
  const merged = mergeDetectedGroupOrder(current, detected.groups, detected.collabGroups);

  return NextResponse.json({
    path: "data/groupOrder.json",
    order: current,
    merged,
    detected,
    missing: {
      groups: merged.groups.filter((entry) => !current.groups.some((item) => item.name === entry.name)).map((entry) => entry.name),
      collabGroups: merged.collabGroups
        .filter((entry) => !current.collabGroups.some((item) => item.name === entry.name))
        .map((entry) => entry.name),
    },
    orphaned: {
      groups: findOrphanGroupEntries(current.groups, detected.groups),
      collabGroups: findOrphanGroupEntries(current.collabGroups, detected.collabGroups),
    },
  });
}

export async function PUT(request: NextRequest) {
  if (!assertAdmin(request)) {
    return unauthorized();
  }

  const payload = (await request.json()) as Partial<GroupOrderFile>;
  const order = normalizeGroupOrderFile(payload);
  await writeGroupOrder(order);
  clearCharacterCache();

  return NextResponse.json({
    path: "data/groupOrder.json",
    order,
    savedAt: new Date().toISOString(),
  });
}
