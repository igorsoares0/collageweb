import { getDb } from "@/lib/db";
import { validateTemplate } from "@/lib/template/validate";
import type { TemplateRecord } from "@/lib/persistence/TemplateRepository";

export async function GET() {
  const sql = getDb();
  if (!sql) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  }
  const rows = await sql`
    SELECT id, name,
           COALESCE((template_json->>'schemaVersion')::int, 1) AS "schemaVersion",
           template_json->>'aspectRatio' AS "aspectRatio",
           category, premium, thumbnail_url AS "thumbnailDataUrl",
           updated_at AS "updatedAt"
    FROM templates
    ORDER BY updated_at DESC
  `;
  return Response.json(rows);
}

export async function POST(request: Request) {
  const sql = getDb();
  if (!sql) {
    return Response.json({ error: "DATABASE_URL not configured" }, { status: 503 });
  }

  let record: TemplateRecord;
  try {
    record = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = validateTemplate(record?.template);
  if (!result.valid) {
    return Response.json(
      { error: `Invalid template: ${result.errors.join("; ")}` },
      { status: 422 }
    );
  }

  const t = record.template;
  await sql`
    INSERT INTO templates (id, name, version, category, premium, thumbnail_url, template_json, created_at, updated_at)
    VALUES (${t.id}, ${t.name}, ${t.version}, ${record.category ?? null},
            ${record.premium ?? false}, ${record.thumbnailDataUrl ?? null},
            ${JSON.stringify(t)}::jsonb, now(), now())
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      version = EXCLUDED.version,
      category = EXCLUDED.category,
      premium = EXCLUDED.premium,
      thumbnail_url = EXCLUDED.thumbnail_url,
      template_json = EXCLUDED.template_json,
      updated_at = now()
  `;
  return Response.json({ ok: true });
}
