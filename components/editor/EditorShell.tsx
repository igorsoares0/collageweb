"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { getRepository } from "@/lib/persistence/localStorageRepository";
import { GOOGLE_FONTS_CSS_URL } from "@/lib/fonts";
import Toolbar from "./Toolbar";
import LayerTree from "./LayerTree";
import PropertiesPanel from "./PropertiesPanel";
import type { Category } from "@/lib/template/types";

// Konva is browser-only; ssr:false is legal here because this is a Client Component.
const CanvasStage = dynamic(() => import("./canvas/CanvasStage"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-zinc-500">
      Loading canvas…
    </div>
  ),
});

export interface RecordMeta {
  category?: Category;
  premium: boolean;
  createdAt: string;
}

export default function EditorShell({ id }: { id: string }) {
  const loadTemplate = useEditorStore((s) => s.loadTemplate);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const removeLayer = useEditorStore((s) => s.removeLayer);

  const [status, setStatus] = useState<"loading" | "ready" | "missing">(
    "loading"
  );
  const [meta, setMeta] = useState<RecordMeta>({
    premium: false,
    createdAt: new Date().toISOString(),
  });

  const thumbnailFnRef = useRef<(() => string) | null>(null);
  const registerThumbnail = useCallback((fn: () => string) => {
    thumbnailFnRef.current = fn;
  }, []);
  const getThumbnail = useCallback(
    () => thumbnailFnRef.current?.() || undefined,
    []
  );

  useEffect(() => {
    getRepository()
      .get(id)
      .then((record) => {
        if (!record) {
          setStatus("missing");
          return;
        }
        loadTemplate(record.template);
        setMeta({
          category: record.category,
          premium: record.premium,
          createdAt: record.createdAt,
        });
        setStatus("ready");
      });
  }, [id, loadTemplate]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        const selected = useEditorStore.getState().selectedLayerId;
        if (selected) {
          e.preventDefault();
          removeLayer(selected);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, removeLayer]);

  if (status === "missing") {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-300 font-sans">
        <p>Template not found.</p>
        <Link href="/" className="text-indigo-400 hover:underline text-sm">
          Back to templates
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-zinc-950 text-zinc-100 font-sans">
      {/* Canvas fonts by literal family name (next/font would hash them). */}
      <link rel="stylesheet" precedence="default" href={GOOGLE_FONTS_CSS_URL} />
      <Toolbar meta={meta} onMetaChange={setMeta} getThumbnail={getThumbnail} />
      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_280px]">
        <LayerTree />
        <div className="min-h-0">
          {status === "ready" && (
            <CanvasStage registerThumbnail={registerThumbnail} />
          )}
        </div>
        <PropertiesPanel />
      </div>
    </div>
  );
}
