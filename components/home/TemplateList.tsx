"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getRepository } from "@/lib/persistence/repository";
import { createTemplate, serializeTemplate } from "@/lib/template/factory";
import { importTemplateFile } from "@/lib/file-io";
import type { TemplateSummary } from "@/lib/persistence/TemplateRepository";

export default function TemplateList() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = () =>
    getRepository()
      .list()
      .then((list) => {
        setTemplates(list);
        setLoaded(true);
      });

  useEffect(() => {
    refresh();
  }, []);

  const handleNew = async () => {
    const template = createTemplate();
    const now = new Date().toISOString();
    await getRepository().save({
      // Store the wire shape (a brand-new template is single-panel → v1).
      template: serializeTemplate(template) as unknown as typeof template,
      premium: false,
      createdAt: now,
      updatedAt: now,
    });
    router.push(`/editor/${template.id}`);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    await getRepository().remove(id);
    refresh();
  };

  const handleImport = async (file: File) => {
    setError(null);
    const result = await importTemplateFile(file);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    const repo = getRepository();
    const template = result.template;
    if (await repo.get(template.id)) {
      template.id = `${template.id}-copy`;
      template.name = `${template.name} (copy)`;
    }
    const now = new Date().toISOString();
    await repo.save({ template, premium: false, createdAt: now, updatedAt: now });
    refresh();
  };

  return (
    <div className="flex-1 bg-zinc-950 text-zinc-100 font-sans">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Collage Studio
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Design templates for stories, posts and reels.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800"
            >
              Import JSON
            </button>
            <button
              onClick={handleNew}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
            >
              New template
            </button>
          </div>
        </header>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImport(file);
            e.target.value = "";
          }}
        />

        {error && (
          <div className="mb-6 rounded-md border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loaded && templates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 py-20 text-center text-zinc-500">
            No templates yet. Create your first one.
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {templates.map((t) => (
              <li
                key={t.id}
                className="group rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden hover:border-zinc-600"
              >
                <button
                  onClick={() => router.push(`/editor/${t.id}`)}
                  className="block w-full text-left"
                >
                  <div className="aspect-square bg-zinc-800 flex items-center justify-center overflow-hidden">
                    {t.thumbnailDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- data URL thumbnail
                      <img
                        src={t.thumbnailDataUrl}
                        alt={t.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-zinc-500">No preview</span>
                    )}
                  </div>
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {t.aspectRatio}
                      {t.category ? ` · ${t.category}` : ""}
                      {t.premium ? " · premium" : ""}
                    </p>
                  </div>
                </button>
                <div className="px-3 pb-2">
                  <button
                    onClick={() => handleDelete(t.id, t.name)}
                    className="text-xs text-zinc-500 hover:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
