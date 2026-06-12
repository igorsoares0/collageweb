// Template JSON schema — the contract consumed by the Flutter renderer.
// See "Collage Studio - Product & Architecture Specification.md" §5–13.

export type AspectRatio = "story" | "post" | "square";

export type LayerType = "image" | "text" | "shape" | "sticker";

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

export type Layer = ImageLayer | TextLayer | ShapeLayer | StickerLayer;

export interface Template {
  id: string;
  version: number;
  name: string;
  aspectRatio: AspectRatio;
  canvas: {
    width: number;
    height: number;
  };
  // Index 0 = bottom of the stack (Konva/Flutter render order).
  layers: Layer[];
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
