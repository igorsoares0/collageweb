import { getDb } from "@/lib/db";
import type { AssetType, FrameWindow } from "@/lib/persistence/AssetRepository";

// Data URLs are stored inline (base64) like template thumbnails — assets are a
// few KB. Cap the body so a malformed/huge upload can't bloat a row. NOTE: like
// the rest of this API, there is NO auth yet — this is a write endpoint and must
// be gated (auth + rate limit) before any public deploy.
const MAX_DATA_URL = 3_000_000; // ~2 MB image as base64
const TYPES: AssetType[] = ["frame", "sticker", "photo"];

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

// A window is valid when every field is a number within [0,1] and the rect fits.
function validWindow(w: unknown): w is FrameWindow {
  if (typeof w !== "object" || w === null) return false;
  const r = w as Record<string, unknown>;
  const fields = [r.x, r.y, r.w, r.h];
  if (!fields.every(isNum)) return false;
  const { x, y, w: ww, h } = r as Record<string, number>;
  return (
    x >= 0 &&
    y >= 0 &&
    ww > 0 &&
    h > 0 &&
    x + ww <= 1.0001 &&
    y + h <= 1.0001
  );
}

export async function GET() {
  const sql = getDb();
  if (!sql) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  }
  const rows = await sql`
    SELECT id, type, name, data_url AS "dataUrl", aspect, "window",
           created_at AS "createdAt"
    FROM assets
    ORDER BY created_at DESC
  `;
  return Response.json(rows);
}

export async function POST(request: Request) {
  const sql = getDb();
  if (!sql) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const { type, name, dataUrl, aspect, window } = body;

  if (typeof type !== "string" || !TYPES.includes(type as AssetType)) {
    return badRequest(`"type" must be one of: ${TYPES.join(", ")}`);
  }
  if (typeof name !== "string" || name.trim().length === 0) {
    return badRequest('"name" must be a non-empty string');
  }
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    return badRequest('"dataUrl" must be a data:image/* URL');
  }
  if (dataUrl.length > MAX_DATA_URL) {
    return badRequest("image is too large");
  }
  if (!isNum(aspect) || aspect <= 0) {
    return badRequest('"aspect" must be a positive number');
  }
  // Frames need a window (where the photo shows); stickers must not carry one.
  if (type === "frame" && !validWindow(window)) {
    return badRequest('"window" is required for frames (x,y,w,h in 0..1)');
  }
  const win: FrameWindow | null = type === "frame" ? (window as FrameWindow) : null;

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await sql`
    INSERT INTO assets (id, type, name, data_url, aspect, "window", created_at)
    VALUES (${id}, ${type}, ${name}, ${dataUrl}, ${aspect},
            ${win ? JSON.stringify(win) : null}::jsonb, ${createdAt})
  `;
  return Response.json(
    { id, type, name, dataUrl, aspect, window: win, createdAt },
    { status: 201 }
  );
}
