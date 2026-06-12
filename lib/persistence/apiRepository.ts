import type {
  TemplateRecord,
  TemplateRepository,
  TemplateSummary,
} from "./TemplateRepository";

async function expectOk(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed with ${res.status}`);
  }
  return res;
}

// Talks to the Neon-backed route handlers under /api/templates.
export class ApiTemplateRepository implements TemplateRepository {
  async list(): Promise<TemplateSummary[]> {
    const res = await expectOk(await fetch("/api/templates"));
    return res.json();
  }

  async get(id: string): Promise<TemplateRecord | null> {
    const res = await fetch(`/api/templates/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    await expectOk(res);
    return res.json();
  }

  async save(record: TemplateRecord): Promise<void> {
    await expectOk(
      await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      })
    );
  }

  async remove(id: string): Promise<void> {
    await expectOk(
      await fetch(`/api/templates/${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
    );
  }
}
