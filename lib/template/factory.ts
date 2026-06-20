import { CURRENT_SCHEMA_VERSION } from "./types";
import type { AspectRatio, Layer, LayerType, Panel, Template } from "./types";

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
  if (panels.length === 1) {
    return {
      id,
      schemaVersion: 1,
      version,
      name,
      aspectRatio,
      canvas: { width, height, backgroundColor: panels[0].backgroundColor },
      layers: panels[0].layers,
    };
  }
  return {
    id,
    schemaVersion: 2,
    version,
    name,
    aspectRatio,
    canvas: { width, height },
    panels,
  };
}

function nextSlotId(template: Template, prefix: string): string {
  // slotIds are unique across the whole template (the app keys user content by
  // slotId globally), so scan every panel, not just the active one.
  const taken = new Set(
    template.panels.flatMap((p) =>
      p.layers.flatMap((l) => ("slotId" in l ? [l.slotId] : []))
    )
  );
  let n = 1;
  while (taken.has(`${prefix}_${n}`)) n++;
  return `${prefix}_${n}`;
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
  }
}
