import { getDb } from "@/lib/db";

interface Context {
  params: Promise<{ id: string }>;
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
