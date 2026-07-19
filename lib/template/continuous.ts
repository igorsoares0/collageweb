// The slide-aware layer over the v4 continuous canvas (Modelo B).
// See docs/model-b-migration.md (in the collageapp repo).
//
// These are PURE DERIVATIONS. A layer never carries a slideIndex: which slide
// it belongs to is computed from its geometry every time. That is the contract
// that keeps the continuous canvas a superset — a panorama (one layer crossing
// cuts) and independent pages (nothing crossing) live in the same layers[].
//
// Every function here is mirrored verbatim in the Flutter renderer
// (lib/src/model/slide_aware.dart) so both sides agree on where a slide ends.

import type { ContinuousCanvas, Layer } from "./types";

export interface SlideRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// A right edge lands exactly on the next slide's origin (x = slideWidth with no
// gutter), which would read as "spans two slides". Treat the edge as exclusive.
const EDGE_EPSILON = 1e-6;

// Distance from one slide's origin to the next.
export function slidePitch(canvas: ContinuousCanvas): number {
  return canvas.slideWidth + canvas.gutter;
}

// Total width of the document: N slides plus the N-1 gutters BETWEEN them
// (no outer gutter).
export function contentWidth(canvas: ContinuousCanvas): number {
  const { slideWidth, slideCount, gutter } = canvas;
  return slideCount * slideWidth + Math.max(0, slideCount - 1) * gutter;
}

// The region slide `i` occupies in continuous space — the export crop rect and
// the editor's cut guides both come from here.
export function slideRect(canvas: ContinuousCanvas, i: number): SlideRect {
  return {
    x: i * slidePitch(canvas),
    y: 0,
    width: canvas.slideWidth,
    height: canvas.slideHeight,
  };
}

// Which slide a point falls in, clamped to the document.
export function slideIndexAtX(canvas: ContinuousCanvas, x: number): number {
  const pitch = slidePitch(canvas);
  if (pitch <= 0) return 0;
  const raw = Math.floor(x / pitch);
  return Math.min(Math.max(raw, 0), Math.max(0, canvas.slideCount - 1));
}

// Every layer type carries x and width (a TextLayer has no height, but it does
// have a width), so horizontal placement is always answerable.
function layerSpanX(layer: Layer): { x: number; width: number } {
  return { x: layer.x, width: layer.width };
}

// The slide a layer BELONGS to, decided by its centre. Used for slide-scoped
// operations (reorder as a group, delete a slide's content) — a layer that
// merely spills over a cut still belongs to the slide holding most of it.
export function slideOf(canvas: ContinuousCanvas, layer: Layer): number {
  const { x, width } = layerSpanX(layer);
  return slideIndexAtX(canvas, x + width / 2);
}

// The layers belonging to slide `i` — "page i" as a movable group.
export function layersInSlide(
  canvas: ContinuousCanvas,
  layers: Layer[],
  i: number
): Layer[] {
  return layers.filter((l) => slideOf(canvas, l) === i);
}

// True when a layer actually crosses a cut line (a real panorama element).
// Reorder/delete must never silently tear one of these — the UI warns instead.
export function spansSlides(canvas: ContinuousCanvas, layer: Layer): boolean {
  const { x, width } = layerSpanX(layer);
  const right = Math.max(x, x + width - EDGE_EPSILON);
  return slideIndexAtX(canvas, x) !== slideIndexAtX(canvas, right);
}
