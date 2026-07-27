import { getDb } from "@/lib/db";

interface Context {
  params: Promise<{ id: string }>;
}

// Toggles the paid-plan gate (the only mutable field). Returns the updated row
// so the store can reflect it without a refetch; 404 if the asset is gone.
export async function PATCH(request: Request, context: Context) {
  const sql = getDb();
  if (!sql) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  }
  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body.premium !== "boolean") {
    return Response.json({ error: '"premium" must be a boolean' }, { status: 400 });
  }

  const rows = await sql`
    UPDATE assets SET premium = ${body.premium} WHERE id = ${id}
    RETURNING id, type, name, data_url AS "dataUrl", aspect, "window",
              premium, created_at AS "createdAt"
  `;
  if (rows.length === 0) {
    return Response.json({ error: "Asset not found" }, { status: 404 });
  }
  return Response.json(rows[0]);
}

export async function DELETE(_request: Request, context: Context) {
  const sql = getDb();
  if (!sql) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  }
  const { id } = await context.params;
  await sql`DELETE FROM assets WHERE id = ${id}`;
  return Response.json({ ok: true });
}
