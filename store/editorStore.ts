"use client";

import { create } from "zustand";
import { CANVAS_FORMATS, createLayer, createPanel } from "@/lib/template/factory";
import {
  collectSlotIds,
  findGridPreset,
  presetCells,
} from "@/lib/template/grid";
import type {
  AspectRatio,
  Layer,
  LayerType,
  Panel,
  Template,
} from "@/lib/template/types";

const HISTORY_LIMIT = 50;

interface EditorState {
  template: Template | null;
  activePanelId: string | null;
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
  // Reshape a grid layer to a named preset (fresh, template-unique cell slotIds).
  applyGridPreset: (id: string, presetId: string) => void;
  selectLayer: (id: string | null) => void;
  toggleLock: (id: string) => void;
  toggleHide: (id: string) => void;
  // Panel (carousel slide) management.
  selectPanel: (id: string) => void;
  addPanel: () => void;
  duplicatePanel: (id: string) => void;
  removePanel: (id: string) => void;
  reorderPanel: (id: string, direction: "left" | "right") => void;
  beginHistory: () => void;
  undo: () => void;
  redo: () => void;
  markSaved: (template: Template) => void;
}

// Fresh slotId not already used anywhere in the template (slotIds are global).
function freshSlotId(taken: Set<string>, prefix: string): string {
  let n = 1;
  while (taken.has(`${prefix}_${n}`)) n++;
  const id = `${prefix}_${n}`;
  taken.add(id);
  return id;
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

  // Replace the active panel's layers/fields. Most editing actions are scoped
  // to one panel; this keeps the rest of the carousel untouched.
  const mutatePanel = (fn: (p: Panel) => Panel, withHistory = true) => {
    const { activePanelId } = get();
    mutateTemplate(
      (t) => ({
        ...t,
        panels: t.panels.map((p) =>
          p.id === (activePanelId ?? t.panels[0].id) ? fn(p) : p
        ),
      }),
      withHistory
    );
  };

  return {
    template: null,
    activePanelId: null,
    selectedLayerId: null,
    dirty: false,
    past: [],
    future: [],

    loadTemplate: (template) =>
      set({
        template: structuredClone(template),
        activePanelId: template.panels[0]?.id ?? null,
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
        },
      })),

    setBackgroundColor: (backgroundColor) =>
      mutatePanel((p) => ({ ...p, backgroundColor })),

    addLayer: (type) => {
      const { template } = get();
      if (!template) return;
      const layer = createLayer(type, template);
      mutatePanel((p) => ({ ...p, layers: [...p.layers, layer] }));
      set({ selectedLayerId: layer.id });
    },

    // No history push — used per-frame during drag/transform. Callers that
    // need an undo point call beginHistory() first.
    updateLayer: (id, patch) =>
      mutatePanel(
        (p) => ({
          ...p,
          layers: p.layers.map((l) =>
            l.id === id ? ({ ...l, ...patch } as Layer) : l
          ),
        }),
        false
      ),

    removeLayer: (id) => {
      mutatePanel((p) => ({ ...p, layers: p.layers.filter((l) => l.id !== id) }));
      if (get().selectedLayerId === id) set({ selectedLayerId: null });
    },

    reorderLayer: (id, direction) =>
      mutatePanel((p) => {
        const index = p.layers.findIndex((l) => l.id === id);
        // index 0 = bottom of the stack; "up" moves toward the front (end).
        const target = direction === "up" ? index + 1 : index - 1;
        if (index < 0 || target < 0 || target >= p.layers.length) return p;
        const layers = [...p.layers];
        [layers[index], layers[target]] = [layers[target], layers[index]];
        return { ...p, layers };
      }),

    applyGridPreset: (id, presetId) => {
      const { template } = get();
      if (!template) return;
      const preset = findGridPreset(presetId);
      // Reuse slotId numbers freed by this grid's current cells; keep every
      // other slot in the template off-limits.
      const taken = new Set(
        template.panels.flatMap((p) =>
          collectSlotIds(p.layers.filter((l) => l.id !== id))
        )
      );
      const cells = presetCells(preset, taken);
      mutatePanel((p) => ({
        ...p,
        layers: p.layers.map((l) =>
          l.id === id && l.type === "grid"
            ? {
                ...l,
                cols: preset.cols,
                rows: preset.rows,
                colFractions: [...preset.colFractions],
                rowFractions: [...preset.rowFractions],
                cells,
              }
            : l
        ),
      }));
    },

    selectLayer: (id) => set({ selectedLayerId: id }),

    toggleLock: (id) =>
      mutatePanel((p) => ({
        ...p,
        layers: p.layers.map((l) =>
          l.id === id
            ? { ...l, editor: { ...l.editor, locked: !l.editor?.locked } }
            : l
        ),
      })),

    toggleHide: (id) => {
      mutatePanel((p) => ({
        ...p,
        layers: p.layers.map((l) =>
          l.id === id
            ? { ...l, editor: { ...l.editor, hidden: !l.editor?.hidden } }
            : l
        ),
      }));
      // Transformer can't attach to invisible nodes.
      if (get().selectedLayerId === id) set({ selectedLayerId: null });
    },

    selectPanel: (id) => set({ activePanelId: id, selectedLayerId: null }),

    addPanel: () => {
      const panel = createPanel();
      mutateTemplate((t) => ({ ...t, panels: [...t.panels, panel] }));
      set({ activePanelId: panel.id, selectedLayerId: null });
    },

    duplicatePanel: (id) => {
      const { template } = get();
      if (!template) return;
      const source = template.panels.find((p) => p.id === id);
      if (!source) return;
      // slotIds must stay unique across the template; regenerate them (and
      // layer ids) for the copy so user content still binds per-slot. Grid
      // cells each carry their own slotId, so re-mint every one of them too.
      const taken = new Set(
        template.panels.flatMap((p) => collectSlotIds(p.layers))
      );
      const copy: Panel = {
        id: crypto.randomUUID(),
        backgroundColor: source.backgroundColor,
        layers: source.layers.map((l) => {
          const cloned = { ...l, id: crypto.randomUUID() } as Layer;
          if (cloned.type === "grid") {
            cloned.cells = cloned.cells.map((c) => ({
              ...c,
              slotId: freshSlotId(taken, "cell"),
            }));
          } else if ("slotId" in cloned) {
            const prefix = cloned.type === "image" ? "image" : "text";
            cloned.slotId = freshSlotId(taken, prefix);
          }
          return cloned;
        }),
      };
      mutateTemplate((t) => {
        const index = t.panels.findIndex((p) => p.id === id);
        const panels = [...t.panels];
        panels.splice(index + 1, 0, copy);
        return { ...t, panels };
      });
      set({ activePanelId: copy.id, selectedLayerId: null });
    },

    removePanel: (id) => {
      const { template } = get();
      if (!template || template.panels.length <= 1) return;
      mutateTemplate((t) => ({
        ...t,
        panels: t.panels.filter((p) => p.id !== id),
      }));
      if (get().activePanelId === id) {
        const remaining = get().template?.panels ?? [];
        set({ activePanelId: remaining[0]?.id ?? null, selectedLayerId: null });
      }
    },

    reorderPanel: (id, direction) =>
      mutateTemplate((t) => {
        const index = t.panels.findIndex((p) => p.id === id);
        const target = direction === "right" ? index + 1 : index - 1;
        if (index < 0 || target < 0 || target >= t.panels.length) return t;
        const panels = [...t.panels];
        [panels[index], panels[target]] = [panels[target], panels[index]];
        return { ...t, panels };
      }),

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
        ...reconcileSelection(previous, get()),
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
        ...reconcileSelection(next, get()),
      });
    },

    markSaved: (template) =>
      set({ template: structuredClone(template), dirty: false }),
  };
});

// After undo/redo the restored template may not contain the active panel or
// selected layer (a panel/layer add being undone). Snap both back to something
// that exists so the canvas and panels strip stay consistent.
function reconcileSelection(
  template: Template,
  state: { activePanelId: string | null; selectedLayerId: string | null }
): { activePanelId: string | null; selectedLayerId: string | null } {
  const panel =
    template.panels.find((p) => p.id === state.activePanelId) ??
    template.panels[0] ??
    null;
  const selectedLayerId =
    panel && panel.layers.some((l) => l.id === state.selectedLayerId)
      ? state.selectedLayerId
      : null;
  return { activePanelId: panel?.id ?? null, selectedLayerId };
}
