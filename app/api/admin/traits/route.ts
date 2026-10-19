import { isAdminRequest } from "@/lib/server/adminAuth";
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { clearCharacterCache } from "@/lib/characterStore";
import { readTraitMaster, traitMasterRelativePath, writeTraitMaster } from "@/lib/traitMasterStore";
import { normalizeTraitTemplate } from "@/lib/traits";
import type { TraitMasterFile, TraitTemplate } from "@/lib/types";

const CANDIDATE_FILES = {
  traitTemplateCandidates: path.join(process.cwd(), "data", "traitTemplateCandidates.json"),
  blessingTraitTemplateCandidates: path.join(process.cwd(), "data", "blessingTraitTemplateCandidates.json"),
  unmatchedTraitTemplateCandidates: path.join(process.cwd(), "data", "unmatchedTraitTemplateCandidates.json"),
  traitTemplateMatches: path.join(process.cwd(), "data", "traitTemplateMatches.json"),
  unmatchedCompositeTraitParts: path.join(process.cwd(), "data", "unmatchedCompositeTraitParts.json"),
  compositeTraitRowCandidates: path.join(process.cwd(), "data", "compositeTraitRowCandidates.json"),
};

function unauthorized() {
  return new NextResponse("Unauthorized", { status: 401 });
}

function assertAdmin(request: NextRequest) {
  return isAdminRequest(request);
}

function normalizePayload(payload: Partial<TraitMasterFile>): TraitMasterFile {
  const templates = Array.isArray(payload.templates)
    ? payload.templates
        .map(normalizeTraitTemplate)
        .filter((template): template is TraitTemplate => Boolean(template))
    : [];
  return {
    meta: {
      updatedAt: new Date().toISOString(),
    },
    templates,
  };
}

async function readCandidateFile(filePath: string) {
  try {
    const text = await readFile(filePath, "utf8");
    const data = JSON.parse(text) as unknown;
    if (!data || typeof data !== "object") {
      return { meta: {}, candidates: [] };
    }
    const record = data as { meta?: unknown; candidates?: unknown };
    return {
      meta: record.meta && typeof record.meta === "object" ? record.meta : {},
      candidates: Array.isArray(record.candidates) ? record.candidates : [],
    };
  } catch {
    return { meta: {}, candidates: [] };
  }
}

async function readMatchFile(filePath: string) {
  try {
    const text = await readFile(filePath, "utf8");
    const data = JSON.parse(text) as unknown;
    if (!data || typeof data !== "object") {
      return { meta: {}, matches: [] };
    }
    const record = data as { meta?: unknown; matches?: unknown };
    return {
      meta: record.meta && typeof record.meta === "object" ? record.meta : {},
      matches: Array.isArray(record.matches) ? record.matches : [],
    };
  } catch {
    return { meta: {}, matches: [] };
  }
}

async function readCandidateFiles() {
  const [
    traitTemplateCandidates,
    blessingTraitTemplateCandidates,
    unmatchedTraitTemplateCandidates,
    traitTemplateMatches,
    unmatchedCompositeTraitParts,
    compositeTraitRowCandidates,
  ] = await Promise.all([
    readCandidateFile(CANDIDATE_FILES.traitTemplateCandidates),
    readCandidateFile(CANDIDATE_FILES.blessingTraitTemplateCandidates),
    readCandidateFile(CANDIDATE_FILES.unmatchedTraitTemplateCandidates),
    readMatchFile(CANDIDATE_FILES.traitTemplateMatches),
    readCandidateFile(CANDIDATE_FILES.unmatchedCompositeTraitParts),
    readCandidateFile(CANDIDATE_FILES.compositeTraitRowCandidates),
  ]);
  return {
    traitTemplateCandidates,
    blessingTraitTemplateCandidates,
    unmatchedTraitTemplateCandidates,
    traitTemplateMatches,
    unmatchedCompositeTraitParts,
    compositeTraitRowCandidates,
  };
}

export async function GET(request: NextRequest) {
  if (!assertAdmin(request)) {
    return unauthorized();
  }
  const master = await readTraitMaster();
  return NextResponse.json({
    path: traitMasterRelativePath(),
    candidateFiles: await readCandidateFiles(),
    ...master,
  });
}

export async function PUT(request: NextRequest) {
  if (!assertAdmin(request)) {
    return unauthorized();
  }
  const payload = (await request.json()) as Partial<TraitMasterFile>;
  const next = normalizePayload(payload);
  await writeTraitMaster(next);
  clearCharacterCache();
  return NextResponse.json({
    path: traitMasterRelativePath(),
    candidateFiles: await readCandidateFiles(),
    ...next,
  });
}
