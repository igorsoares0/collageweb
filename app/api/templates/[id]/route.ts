import { getDb } from "@/lib/db";

interface Context {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: Context) {
  const sql = getDb();
  if (!sql) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  }
  const { id } = await context.params;
  const rows = await sql`
    SELECT category, premium, thumbnail_url AS "thumbnailDataUrl",
           template_json AS "template",
           created_at AS "createdAt", updated_at AS "updatedAt"
    FROM templates
    WHERE id = ${id}
  `;
  if (rows.length === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json(rows[0]);
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
