import { isAdminRequest } from "@/lib/server/adminAuth";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const IMAGE_DIR = path.join(process.cwd(), "public", "character-images");
const PUBLIC_PREFIX = "/character-images";
const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function unauthorized() {
  return new NextResponse("Unauthorized", { status: 401 });
}

function assertAdmin(request: NextRequest) {
  return isAdminRequest(request);
}

function safePart(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function POST(request: NextRequest) {
  if (!assertAdmin(request)) {
    return unauthorized();
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const characterId = safePart(String(formData.get("characterId") ?? "manual-character")) || "manual-character";
  if (!(file instanceof File)) {
    return new NextResponse("file is required", { status: 400 });
  }

  const originalName = safePart(file.name || "image");
  const ext = path.extname(originalName).toLowerCase() || ".png";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return new NextResponse("png, jpg, jpeg, webp, gif のみアップロードできます", { status: 400 });
  }

  await mkdir(IMAGE_DIR, { recursive: true });
  const baseName = path.basename(originalName, ext);
  const fileName = `${characterId}-${baseName || "image"}${ext}`;
  const filePath = path.join(IMAGE_DIR, fileName);
  await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({
    imageUrl: `${PUBLIC_PREFIX}/${fileName}`,
    fileName,
    path: `public/character-images/${fileName}`,
  });
}
