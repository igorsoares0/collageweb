"use client";

import Link from "next/link";
import { useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { getRepository } from "@/lib/persistence/repository";
import { validateTemplate } from "@/lib/template/validate";
import { exportTemplate } from "@/lib/file-io";
import { CANVAS_FORMATS, serializeTemplate } from "@/lib/template/factory";
import { CATEGORIES, type AspectRatio, type Category, type LayerType } from "@/lib/template/types";
import type { RecordMeta } from "./EditorShell";

const ADD_BUTTONS: { type: LayerType; label: string }[] = [
  { type: "image", label: "+ Image" },
  { type: "text", label: "+ Text" },
  { type: "shape", label: "+ Shape" },
  { type: "sticker", label: "+ Sticker" },
  { type: "grid", label: "+ Grid" },
];

interface Props {
  meta: RecordMeta;
  onMetaChange: (meta: RecordMeta) => void;
  getThumbnail: () => string | undefined;
}

export default function Toolbar({ meta, onMetaChange, getThumbnail }: Props) {
  const template = useEditorStore((s) => s.template);
  const dirty = useEditorStore((s) => s.dirty);
  const setName = useEditorStore((s) => s.setName);
  const setFormat = useEditorStore((s) => s.setFormat);
  const addLayer = useEditorStore((s) => s.addLayer);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const markSaved = useEditorStore((s) => s.markSaved);

  const [errors, setErrors] = useState<string[]>([]);

  if (!template) {
    return <div className="h-12 border-b border-zinc-800 bg-zinc-900" />;
  }

  const handleSave = async () => {
    // Version increments on every publish (spec §22).
    const candidate = { ...template, version: template.version + 1 };
    // Persist the wire shape (v1 for single panel, v2 for multi) and validate
    // exactly what we store; the editor keeps the canonical panels form.
    const wire = serializeTemplate(candidate);
    const result = validateTemplate(wire);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    await getRepository().save({
      template: wire as unknown as typeof candidate,
      category: meta.category,
      premium: meta.premium,
      thumbnailDataUrl: getThumbnail(),
      createdAt: meta.createdAt,
      updatedAt: new Date().toISOString(),
    });
    markSaved(candidate);
  };

  const handleExport = () => {
    const result = validateTemplate(serializeTemplate(template));
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    exportTemplate(template);
  };

  const btn =
    "rounded px-2 py-1 text-xs border border-zinc-700 hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div className="relative z-10">
      <div className="flex h-12 items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-3">
        <Link
          href="/"
          className="rounded px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800"
          title="Back to templates"
        >
          ←
        </Link>
        <input
          value={template.name}
          onChange={(e) => setName(e.target.value)}
          className="w-44 rounded border border-transparent bg-transparent px-2 py-1 text-sm font-medium hover:border-zinc-700 focus:border-zinc-600 focus:outline-none"
          aria-label="Template name"
        />
        <select
          value={template.aspectRatio}
          onChange={(e) => setFormat(e.target.value as AspectRatio)}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
          aria-label="Canvas format"
        >
          {(Object.keys(CANVAS_FORMATS) as AspectRatio[]).map((f) => (
            <option key={f} value={f}>
              {CANVAS_FORMATS[f].label}
            </option>
          ))}
        </select>

        <div className="mx-1 h-6 w-px bg-zinc-800" />

        {ADD_BUTTONS.map(({ type, label }) => (
          <button key={type} onClick={() => addLayer(type)} className={btn}>
            {label}
          </button>
        ))}

        <div className="flex-1" />

        <select
          value={meta.category ?? ""}
          onChange={(e) =>
            onMetaChange({
              ...meta,
              category: (e.target.value || undefined) as Category | undefined,
            })
          }
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
          aria-label="Category"
        >
          <option value="">No category</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={meta.premium}
            onChange={(e) =>
              onMetaChange({ ...meta, premium: e.target.checked })
            }
          />
          Premium
        </label>

        <div className="mx-1 h-6 w-px bg-zinc-800" />

        <button onClick={undo} disabled={!canUndo} className={btn} title="Undo (Ctrl+Z)">
          ↩
        </button>
        <button onClick={redo} disabled={!canRedo} className={btn} title="Redo (Ctrl+Shift+Z)">
          ↪
        </button>

        <button onClick={handleExport} className={btn}>
          Export JSON
        </button>
        <button
          onClick={handleSave}
          className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium hover:bg-indigo-500"
        >
          Save{dirty ? " •" : ""}
        </button>
        <span className="w-16 text-right text-[10px] text-zinc-500">
          v{template.version}
        </span>
      </div>

      {errors.length > 0 && (
        <div className="absolute left-0 right-0 top-full border-b border-red-900 bg-red-950/95 px-4 py-2 text-xs text-red-300">
          <div className="flex items-start justify-between gap-4">
            <ul className="list-disc pl-4">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            <button
              onClick={() => setErrors([])}
              className="text-red-400 hover:text-red-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
