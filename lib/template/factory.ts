import { CURRENT_SCHEMA_VERSION } from "./types";
import type {
  AspectRatio,
  GridLayer,
  Layer,
  LayerType,
  Panel,
  Template,
} from "./types";
import {
  collectSlotIds,
  DEFAULT_GRID_PRESET_ID,
  findGridPreset,
  presetCells,
} from "./grid";

const DEFAULT_BACKGROUND = "#FFFFFF";

export const CANVAS_FORMATS: Record<
  AspectRatio,
  { width: number; height: number; label: string }
> = {
  story: { width: 1080, height: 1920, label: "Story (1080×1920)" },
  post: { width: 1080, height: 1350, label: "Post (1080×1350)" },
  square: { width: 1080, height: 1080, label: "Square (1080×1080)" },
};

// Placeholder catalog until assets live in Supabase Storage.
export const STICKER_ASSETS = [
  "sticker_wave",
  "sticker_star",
  "sticker_heart",
  "sticker_arrow",
  "sticker_badge",
];

// A photo frame (polaroid, etc.): a PNG with a transparent window through which
// the user's photo shows. `aspect` is the frame image's own width/height — a
// framed image layer's bounds follow it so the frame never stretches. `window`
// is the transparent hole in normalized (0..1) frame coords: the photo is drawn
// (and clipped) into that rectangle, then the frame paints over the whole layer.
// Measured from the source PNGs in /public/assets/frames.
export interface FrameAsset {
  id: string;
  label: string;
  src: string;
  aspect: number;
  window: { x: number; y: number; w: number; h: number };
}

export const FRAME_ASSETS: FrameAsset[] = [
  {
    id: "frame_polaroid_v",
    label: "Polaroid (vertical)",
    src: "/assets/frames/pol-vert.png",
    aspect: 1424 / 2010,
    window: { x: 0.0492, y: 0.0244, w: 0.9024, h: 0.8199 },
  },
  {
    id: "frame_polaroid_h",
    label: "Polaroid (horizontal)",
    src: "/assets/frames/pol-hor.png",
    aspect: 2039 / 2010,
    window: { x: 0.0387, y: 0.0244, w: 0.9201, h: 0.8214 },
  },
  {
    id: "frame_quad",
    label: "Quadro",
    src: "/assets/frames/quad.png",
    aspect: 1424 / 2010,
    window: { x: 0.0344, y: 0.0244, w: 0.9298, h: 0.9468 },
  },
];


export function createPanel(backgroundColor = DEFAULT_BACKGROUND): Panel {
  return { id: crypto.randomUUID(), backgroundColor, layers: [] };
}

export function createTemplate(name = "Untitled Template"): Template {
  const { width, height } = CANVAS_FORMATS.story;
  return {
    id: crypto.randomUUID(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    version: 0,
    name,
    aspectRatio: "story",
    canvas: { width, height },
    panels: [createPanel()],
  };
}

// Normalizes any stored/imported shape into the canonical in-memory form
// (a panels array). Handles three histories: pre-schemaVersion templates,
// the classic single-canvas v1 shape (canvas.backgroundColor + top-level
// layers), and the v2 multi-panel shape. Apply on every read path.
export function normalizeTemplate(template: unknown): Template {
  const t = template as Record<string, unknown>;
  const canvas = (t.canvas ?? {}) as Record<string, unknown>;
  const base = {
    id: t.id as string,
    version: t.version as number,
    name: t.name as string,
    aspectRatio: t.aspectRatio as AspectRatio,
    canvas: {
      width: canvas.width as number,
      height: canvas.height as number,
    },
  };

  if (Array.isArray(t.panels)) {
    return {
      ...base,
      schemaVersion: (t.schemaVersion as number) ?? CURRENT_SCHEMA_VERSION,
      panels: (t.panels as Panel[]).map((p) => ({
        id: p.id,
        backgroundColor: p.backgroundColor ?? DEFAULT_BACKGROUND,
        layers: p.layers ?? [],
      })),
    };
  }

  // Classic v1: fold the single canvas into one panel.
  return {
    ...base,
    schemaVersion: 1,
    panels: [
      {
        id: crypto.randomUUID(),
        backgroundColor:
          (canvas.backgroundColor as string) ?? DEFAULT_BACKGROUND,
        layers: (t.layers as Layer[]) ?? [],
      },
    ],
  };
}

// Inverse of normalizeTemplate: produces the wire shape Flutter consumes.
// One panel -> classic v1 (back-compat, byte-identical to pre-panels exports);
// many panels -> v2 with a panels array. schemaVersion is set accordingly.
export function serializeTemplate(template: Template): Record<string, unknown> {
  const { id, version, name, aspectRatio, canvas, panels } = template;
  const { width, height } = canvas;
  // schemaVersion is a capability gate; the wire *shape* (v1 classic vs v2
  // panels) is chosen by panel count. A grid anywhere forces schemaVersion 3
  // (older renderers can't draw it) but doesn't change the shape, so a single
  // grid-bearing panel still serializes as the classic layers array.
  const hasGrid = panels.some((p) => p.layers.some((l) => l.type === "grid"));
  const base = { id, version, name, aspectRatio };
  if (panels.length === 1) {
    return {
      ...base,
      schemaVersion: hasGrid ? 3 : 1,
      canvas: { width, height, backgroundColor: panels[0].backgroundColor },
      layers: panels[0].layers,
    };
  }
  return {
    ...base,
    schemaVersion: hasGrid ? 3 : 2,
    canvas: { width, height },
    panels,
  };
}

// All slotIds already used anywhere in the template (across every panel and,
// for grids, every cell), since the app keys user content by slotId globally.
function takenSlotIds(template: Template): Set<string> {
  return new Set(template.panels.flatMap((p) => collectSlotIds(p.layers)));
}

function nextSlotId(template: Template, prefix: string): string {
  const taken = takenSlotIds(template);
  let n = 1;
  while (taken.has(`${prefix}_${n}`)) n++;
  return `${prefix}_${n}`;
}

// A grid element seeded from a preset. Sized as a large square by default; the
// designer then moves/resizes it and swaps the preset. Cell slotIds are drawn
// unique across the whole template.
export function createGrid(
  template: Template,
  presetId = DEFAULT_GRID_PRESET_ID
): GridLayer {
  const preset = findGridPreset(presetId);
  const { width: cw, height: ch } = template.canvas;
  const width = Math.round(cw * 0.9);
  const height = Math.min(width, Math.round(ch * 0.9));
  return {
    id: crypto.randomUUID(),
    type: "grid",
    x: Math.round((cw - width) / 2),
    y: Math.round((ch - height) / 2),
    width,
    height,
    rotation: 0,
    cols: preset.cols,
    rows: preset.rows,
    colFractions: [...preset.colFractions],
    rowFractions: [...preset.rowFractions],
    gutter: Math.round(cw * 0.015),
    cornerRadius: 0,
    cells: presetCells(preset, takenSlotIds(template)),
  };
}

export function createLayer(type: LayerType, template: Template): Layer {
  const id = crypto.randomUUID();
  const { width: cw, height: ch } = template.canvas;

  switch (type) {
    case "image":
      return {
        id,
        type: "image",
        slotId: nextSlotId(template, "image"),
        x: Math.round(cw * 0.1),
        y: Math.round(ch * 0.1),
        width: Math.round(cw * 0.8),
        height: Math.round(cw * 0.8),
        rotation: 0,
        opacity: 1,
        borderRadius: 0,
      };
    case "text":
      return {
        id,
        type: "text",
        slotId: nextSlotId(template, "text"),
        x: Math.round(cw * 0.1),
        y: Math.round(ch * 0.45),
        width: Math.round(cw * 0.8),
        fontFamily: "Inter",
        fontSize: 64,
        fontWeight: 700,
        color: "#111111",
        alignment: "left",
      };
    case "shape":
      return {
        id,
        type: "shape",
        shape: "rectangle",
        x: 0,
        y: 0,
        width: cw,
        height: ch,
        fill: "#000000",
      };
    case "sticker":
      return {
        id,
        type: "sticker",
        assetId: STICKER_ASSETS[0],
        x: Math.round(cw * 0.35),
        y: Math.round(ch * 0.35),
        width: 300,
        height: 300,
      };
    case "grid":
      return createGrid(template);
  }
}
