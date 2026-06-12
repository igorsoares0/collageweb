import { CURRENT_SCHEMA_VERSION } from "./types";
import type { AspectRatio, Layer, LayerType, Template } from "./types";

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

export function createTemplate(name = "Untitled Template"): Template {
  return {
    id: crypto.randomUUID(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    version: 0,
    name,
    aspectRatio: "story",
    canvas: { ...CANVAS_FORMATS.story },
    layers: [],
  };
}

// Fills fields that older saved templates predate (schemaVersion shipped
// after the first templates were persisted). Apply on every read path.
export function normalizeTemplate(template: Template): Template {
  return {
    ...template,
    schemaVersion: template.schemaVersion ?? 1,
  };
}

function nextSlotId(template: Template, prefix: string): string {
  const taken = new Set(
    template.layers.flatMap((l) => ("slotId" in l ? [l.slotId] : []))
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
