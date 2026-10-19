import { isAdminRequest } from "@/lib/server/adminAuth";
import { NextRequest, NextResponse } from "next/server";
import { readQuests, writeQuests } from "@/lib/questStore";
import type { QuestFile } from "@/lib/types";

function unauthorized() {
  return new NextResponse("Unauthorized", { status: 401 });
}

function assertAdmin(request: NextRequest) {
  return isAdminRequest(request);
}

export async function GET(request: NextRequest) {
  if (!assertAdmin(request)) {
    return unauthorized();
  }
  const file = await readQuests();
  return NextResponse.json({
    path: "data/quests.json",
    ...file,
  });
}

export async function PUT(request: NextRequest) {
  if (!assertAdmin(request)) {
    return unauthorized();
  }
  const payload = await request.json() as QuestFile;
  const file = await writeQuests(payload);
  return NextResponse.json({
    path: "data/quests.json",
    ...file,
  });
}
