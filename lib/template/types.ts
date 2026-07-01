// Template JSON schema — the contract consumed by the Flutter renderer.
// See "Collage Studio - Product & Architecture Specification.md" §5–13.

export type AspectRatio = "story" | "post" | "square";

export type LayerType = "image" | "text" | "shape" | "sticker" | "grid";

export type TextAlignment = "left" | "center" | "right";

// Editor-only metadata; namespaced so the mobile-facing schema stays clean.
// Flutter ignores unknown fields; a future "strip on publish" can remove it.
export interface LayerEditorMeta {
  locked?: boolean;
  hidden?: boolean;
}

export interface BaseLayer {
  id: string;
  editor?: LayerEditorMeta;
}

export interface ImageLayer extends BaseLayer {
  type: "image";
  slotId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  borderRadius: number;
  // Optional decorative frame (polaroid, etc.) painted OVER the user's photo.
  // The asset's transparent window (see FRAME_ASSETS) is where the photo shows;
  // absent = bare photo (unchanged). Additive/optional, so single-panel framed
  // templates still serialize as v1 — an old renderer just draws the bare photo.
  frameAssetId?: string;
}

export interface TextLayer extends BaseLayer {
  type: "text";
  slotId: string;
  x: number;
  y: number;
  width: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  alignment: TextAlignment;
}

export interface ShapeLayer extends BaseLayer {
  type: "shape";
  shape: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
}

export interface StickerLayer extends BaseLayer {
  type: "sticker";
  assetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// One fillable slot of a grid. Position in the grid is given by (col, row) plus
// an optional span; the pixel rect is derived from the grid's fractions/gutter
// by cellRect() (lib/template/grid.ts), reused verbatim by the Flutter renderer.
export interface GridCell {
  slotId: string;
  col: number;
  row: number;
  colSpan?: number; // default 1 — lets a cell straddle tracks ("1 big + 2 small")
  rowSpan?: number;
  borderRadius?: number; // per-cell override; falls back to the grid's cornerRadius
}

// A unified photo grid: one placeable/rotatable element that tiles its box into
// cells separated by a uniform gutter. Columns/rows are sized by fraction tracks
// (like CSS grid fr units) so a divider drag just shifts two adjacent fractions.
// Each cell is a global photo slot (keyed by slotId, like ImageLayer). Renderers
// older than schemaVersion 3 can't draw this (there is no photo to degrade to).
export interface GridLayer extends BaseLayer {
  type: "grid";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  cols: number;
  rows: number;
  colFractions: number[]; // length === cols; only the ratios matter (auto-normalized)
  rowFractions: number[]; // length === rows
  gutter: number; // px: uniform spacing between cells AND the outer margin
  cornerRadius: number; // px: default corner radius for every cell
  gutterColor?: string; // absent = transparent (the panel background shows through)
  cells: GridCell[];
}

export type Layer =
  | ImageLayer
  | TextLayer
  | ShapeLayer
  | StickerLayer
  | GridLayer;

// One slide of the carousel: its own background and layer stack. All panels in
// a template share the template's canvas size (a carousel must be uniform).
export interface Panel {
  id: string;
  backgroundColor: string;
  // Index 0 = bottom of the stack (Konva/Flutter render order).
  layers: Layer[];
}

// Highest template schema this editor (and the current renderers) understand.
// Bump ONLY when the JSON contract gains features old renderers can't draw;
// clients must skip templates with schemaVersion above what they support.
// v2 added multi-panel ("panels"); single-panel templates still serialize as
// v1 (canvas.backgroundColor + top-level layers) for back-compat. v3 added the
// grid layer ("type":"grid"): a template is tagged v3 only when it actually
// contains a grid (see serializeTemplate), so grid-free templates stay v1/v2.
export const CURRENT_SCHEMA_VERSION = 3;

// Canonical in-memory shape: always a panels array (length >= 1). The wire
// shape is back-compat: 1 panel serializes as classic v1 (canvas.backgroundColor
// + layers), >1 as v2 (panels). See normalizeTemplate/serializeTemplate.
export interface Template {
  id: string;
  // Capability gate for renderers (see CURRENT_SCHEMA_VERSION).
  schemaVersion: number;
  // Content revision; increments on every publish (spec §22).
  version: number;
  name: string;
  aspectRatio: AspectRatio;
  // Shared by every panel; backgroundColor now lives on each Panel.
  canvas: {
    width: number;
    height: number;
  };
  panels: Panel[];
}

export type Category =
  | "fashion"
  | "travel"
  | "food"
  | "business"
  | "wedding"
  | "minimal";

export const CATEGORIES: Category[] = [
  "fashion",
  "travel",
  "food",
  "business",
  "wedding",
  "minimal",
];
