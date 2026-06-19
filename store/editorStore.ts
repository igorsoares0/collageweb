"use client";

import { create } from "zustand";
import { CANVAS_FORMATS, createLayer } from "@/lib/template/factory";
import type { AspectRatio, Layer, LayerType, Template } from "@/lib/template/types";

const HISTORY_LIMIT = 50;

interface EditorState {
  template: Template | null;
  selectedLayerId: string | null;
  dirty: boolean;
  past: Template[];
  future: Template[];

  loadTemplate: (template: Template) => void;
  setName: (name: string) => void;
  setFormat: (aspectRatio: AspectRatio) => void;
  setBackgroundColor: (color: string) => void;
  addLayer: (type: LayerType) => void;
  updateLayer: (id: string, patch: Partial<Layer>) => void;
  removeLayer: (id: string) => void;
  reorderLayer: (id: string, direction: "up" | "down") => void;
  selectLayer: (id: string | null) => void;
  toggleLock: (id: string) => void;
  toggleHide: (id: string) => void;
  beginHistory: () => void;
  undo: () => void;
  redo: () => void;
  markSaved: (template: Template) => void;
}

export const useEditorStore = create<EditorState>((set, get) => {
  // Snapshot the current template into the undo stack. Discrete actions call
  // this internally; continuous gestures (drag/transform) call it once at
  // gesture start and then stream updateLayer without history pushes.
  const pushHistory = () => {
    const { template, past } = get();
    if (!template) return;
    set({
      past: [...past.slice(-(HISTORY_LIMIT - 1)), structuredClone(template)],
      future: [],
    });
  };

  const mutateTemplate = (fn: (t: Template) => Template, withHistory = true) => {
    const { template } = get();
    if (!template) return;
    if (withHistory) pushHistory();
    set({ template: fn(template), dirty: true });
  };

  return {
    template: null,
    selectedLayerId: null,
    dirty: false,
    past: [],
    future: [],

    loadTemplate: (template) =>
      set({
        template: structuredClone(template),
        selectedLayerId: null,
        dirty: false,
        past: [],
        future: [],
      }),

    setName: (name) => mutateTemplate((t) => ({ ...t, name })),

    setFormat: (aspectRatio) =>
      mutateTemplate((t) => ({
        ...t,
        aspectRatio,
        canvas: {
          width: CANVAS_FORMATS[aspectRatio].width,
          height: CANVAS_FORMATS[aspectRatio].height,
          // Preserve the chosen background across format changes.
          backgroundColor: t.canvas.backgroundColor,
        },
      })),

    setBackgroundColor: (backgroundColor) =>
      mutateTemplate((t) => ({
        ...t,
        canvas: { ...t.canvas, backgroundColor },
      })),

    addLayer: (type) => {
      const { template } = get();
      if (!template) return;
      const layer = createLayer(type, template);
      mutateTemplate((t) => ({ ...t, layers: [...t.layers, layer] }));
      set({ selectedLayerId: layer.id });
    },

    // No history push — used per-frame during drag/transform. Callers that
    // need an undo point call beginHistory() first.
    updateLayer: (id, patch) =>
      mutateTemplate(
        (t) => ({
          ...t,
          layers: t.layers.map((l) =>
            l.id === id ? ({ ...l, ...patch } as Layer) : l
          ),
        }),
        false
      ),

    removeLayer: (id) => {
      mutateTemplate((t) => ({
        ...t,
        layers: t.layers.filter((l) => l.id !== id),
      }));
      if (get().selectedLayerId === id) set({ selectedLayerId: null });
    },

    reorderLayer: (id, direction) =>
      mutateTemplate((t) => {
        const index = t.layers.findIndex((l) => l.id === id);
        // index 0 = bottom of the stack; "up" moves toward the front (end).
        const target = direction === "up" ? index + 1 : index - 1;
        if (index < 0 || target < 0 || target >= t.layers.length) return t;
        const layers = [...t.layers];
        [layers[index], layers[target]] = [layers[target], layers[index]];
        return { ...t, layers };
      }),

    selectLayer: (id) => set({ selectedLayerId: id }),

    toggleLock: (id) =>
      mutateTemplate((t) => ({
        ...t,
        layers: t.layers.map((l) =>
          l.id === id
            ? { ...l, editor: { ...l.editor, locked: !l.editor?.locked } }
            : l
        ),
      })),

    toggleHide: (id) => {
      mutateTemplate((t) => ({
        ...t,
        layers: t.layers.map((l) =>
          l.id === id
            ? { ...l, editor: { ...l.editor, hidden: !l.editor?.hidden } }
            : l
        ),
      }));
      // Transformer can't attach to invisible nodes.
      if (get().selectedLayerId === id) set({ selectedLayerId: null });
    },

    beginHistory: pushHistory,

    undo: () => {
      const { template, past, future } = get();
      if (!template || past.length === 0) return;
      const previous = past[past.length - 1];
      set({
        template: previous,
        past: past.slice(0, -1),
        future: [structuredClone(template), ...future],
        dirty: true,
        selectedLayerId: previous.layers.some(
          (l) => l.id === get().selectedLayerId
        )
          ? get().selectedLayerId
          : null,
      });
    },

    redo: () => {
      const { template, past, future } = get();
      if (!template || future.length === 0) return;
      const next = future[0];
      set({
        template: next,
        past: [...past, structuredClone(template)],
        future: future.slice(1),
        dirty: true,
        selectedLayerId: next.layers.some((l) => l.id === get().selectedLayerId)
          ? get().selectedLayerId
          : null,
      });
    },

    markSaved: (template) =>
      set({ template: structuredClone(template), dirty: false }),
  };
});
