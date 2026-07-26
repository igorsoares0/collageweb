import { getDb } from "@/lib/db";

interface Context {
  params: Promise<{ id: string }>;
}

// Every photo asset the template references (image layers and grid cells),
// across both wire shapes (v1 top-level layers, v2 panels). These ride along
// in the template response so the app only downloads the photos of templates
// it actually opens — they are excluded from the global /api/assets catalog
// the app fetches (see ?types= there).
function collectPhotoIds(template: unknown): string[] {
  const ids = new Set<string>();
  const t = template as { panels?: unknown; layers?: unknown };
  const panels = Array.isArray(t?.panels)
    ? (t.panels as { layers?: unknown }[])
    : [{ layers: t?.layers }];
  for (const panel of panels) {
    if (!Array.isArray(panel?.layers)) continue;
    for (const layer of panel.layers as {
      imageAssetId?: unknown;
      cells?: { imageAssetId?: unknown }[];
    }[]) {
      if (typeof layer?.imageAssetId === "string") ids.add(layer.imageAssetId);
      if (Array.isArray(layer?.cells)) {
        for (const cell of layer.cells) {
          if (typeof cell?.imageAssetId === "string") ids.add(cell.imageAssetId);
        }
      }
    }
  }
  return [...ids];
}

export async function GET(_request: Request, context: Context) {
  const sql = getDb();
  if (!sql) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  }
  const { id } = await context.params;
  const rows = await sql`
    SELECT category, premium, published, thumbnail_url AS "thumbnailDataUrl",
           template_json AS "template",
           created_at AS "createdAt", updated_at AS "updatedAt"
    FROM templates
    WHERE id = ${id}
  `;
  if (rows.length === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const photoIds = collectPhotoIds(rows[0].template);
  const assets =
    photoIds.length > 0
      ? await sql`
          SELECT id, type, name, data_url AS "dataUrl", aspect, "window",
                 created_at AS "createdAt"
          FROM assets
          WHERE id = ANY(${photoIds})
        `
      : [];
  return Response.json({ ...rows[0], assets });
}

export async function DELETE(_request: Request, context: Context) {
  const sql = getDb();
  if (!sql) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  }
  const { id } = await context.params;
  await sql`DELETE FROM templates WHERE id = ${id}`;
  return Response.json({ ok: true });
}
