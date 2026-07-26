import type {
  TemplateRecord,
  TemplateRepository,
  TemplateSummary,
} from "./TemplateRepository";

const INDEX_KEY = "collage:index";
const RECORD_KEY_PREFIX = "collage:tpl:";

function readIndex(): TemplateSummary[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as TemplateSummary[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(index: TemplateSummary[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

function toSummary(record: TemplateRecord): TemplateSummary {
  return {
    id: record.template.id,
    name: record.template.name,
    schemaVersion: record.template.schemaVersion ?? 1,
    aspectRatio: record.template.aspectRatio,
    category: record.category,
    premium: record.premium,
    published: record.published,
    thumbnailDataUrl: record.thumbnailDataUrl,
    updatedAt: record.updatedAt,
  };
}

export class LocalStorageTemplateRepository implements TemplateRepository {
  async list(): Promise<TemplateSummary[]> {
    return readIndex().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<TemplateRecord | null> {
    const raw = localStorage.getItem(RECORD_KEY_PREFIX + id);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as TemplateRecord;
    } catch {
      return null;
    }
  }

  async save(record: TemplateRecord): Promise<void> {
    localStorage.setItem(
      RECORD_KEY_PREFIX + record.template.id,
      JSON.stringify(record)
    );
    const index = readIndex().filter((s) => s.id !== record.template.id);
    index.push(toSummary(record));
    writeIndex(index);
  }

  async remove(id: string): Promise<void> {
    localStorage.removeItem(RECORD_KEY_PREFIX + id);
    writeIndex(readIndex().filter((s) => s.id !== id));
  }
}
