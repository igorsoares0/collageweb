import type { AspectRatio, Category, Template } from "@/lib/template/types";

// Mirrors the planned Supabase "templates" table (spec §28).
export interface TemplateRecord {
  template: Template;
  category?: Category;
  premium: boolean;
  // Whether this template is exposed to the mobile app's catalog. Defaults to
  // false (unpublished) for new templates; the app filters on it.
  published: boolean;
  thumbnailDataUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateSummary {
  id: string;
  name: string;
  // Renderers (mobile sync) must skip entries above the schema they support.
  schemaVersion: number;
  aspectRatio: AspectRatio;
  category?: Category;
  premium: boolean;
  published: boolean;
  thumbnailDataUrl?: string;
  updatedAt: string;
}

// Async even though the current backend is localStorage — this is the seam
// where a Supabase implementation plugs in later.
export interface TemplateRepository {
  list(): Promise<TemplateSummary[]>;
  get(id: string): Promise<TemplateRecord | null>;
  save(record: TemplateRecord): Promise<void>;
  remove(id: string): Promise<void>;
}
