// Grid geometry + presets, shared by the canvas renderer, the properties panel,
// and the factory. The cellRect() math here is mirrored verbatim in the Flutter
// renderer (lib/src/model/template.dart) so both sides tile a grid identically.

import type { GridCell, GridLayer, Layer } from "./types";

export interface CellRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const sumBefore = (xs: number[], i: number) => sum(xs.slice(0, i));
const sumSpan = (xs: number[], start: number, span: number) =>
  sum(xs.slice(start, start + span));

// Pixel rect of a cell inside the grid's local box (origin at the grid's x/y).
// A track's size is its fraction of the usable length (box minus every gutter);
// gutters sit on both outer edges and between tracks. A spanning cell also eats
// the internal gutters it straddles. `fractions` overrides let a live divider
// drag (or a mobile override) recompute without mutating the layer.
export function cellRect(
  grid: Pick<
    GridLayer,
    "width" | "height" | "cols" | "rows" | "colFractions" | "rowFractions" | "gutter"
  >,
  cell: GridCell,
  fractions?: { col?: number[]; row?: number[] }
): CellRect {
  const colF = fractions?.col ?? grid.colFractions;
  const rowF = fractions?.row ?? grid.rowFractions;
  const cs = Math.max(1, cell.colSpan ?? 1);
  const rs = Math.max(1, cell.rowSpan ?? 1);
  const g = grid.gutter;

  const usableW = Math.max(0, grid.width - g * (grid.cols + 1));
  const usableH = Math.max(0, grid.height - g * (grid.rows + 1));
  const sc = sum(colF) || 1;
  const sr = sum(rowF) || 1;

  const x = g * (cell.col + 1) + usableW * (sumBefore(colF, cell.col) / sc);
  const y = g * (cell.row + 1) + usableH * (sumBefore(rowF, cell.row) / sr);
  const width = usableW * (sumSpan(colF, cell.col, cs) / sc) + g * (cs - 1);
  const height = usableH * (sumSpan(rowF, cell.row, rs) / sr) + g * (rs - 1);
  return { x, y, width, height };
}

// Every fillable slotId in a layer stack. Image/text carry one; a grid carries
// one per cell. Used everywhere slotId uniqueness/listing matters.
export function collectSlotIds(layers: Layer[]): string[] {
  return layers.flatMap((l) => {
    if (l.type === "grid") return l.cells.map((c) => c.slotId);
    if ("slotId" in l) return [l.slotId];
    return [];
  });
}

interface PresetCell {
  col: number;
  row: number;
  colSpan?: number;
  rowSpan?: number;
}

export interface GridPreset {
  id: string;
  label: string;
  cols: number;
  rows: number;
  colFractions: number[];
  rowFractions: number[];
  cells: PresetCell[];
}

const ones = (n: number) => Array<number>(n).fill(1);
const gridCells = (cols: number, rows: number): PresetCell[] =>
  Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({ col, row }))
  ).flat();

// The classic collage layouts. "1+2"/"2+1" use a span so one cell straddles a
// row/column; a divider drag on the shared axis leaves the spanning cell intact.
export const GRID_PRESETS: GridPreset[] = [
  { id: "2x2", label: "2 × 2", cols: 2, rows: 2, colFractions: ones(2), rowFractions: ones(2), cells: gridCells(2, 2) },
  { id: "2x1", label: "2 lado a lado", cols: 2, rows: 1, colFractions: ones(2), rowFractions: ones(1), cells: gridCells(2, 1) },
  { id: "1x2", label: "2 empilhadas", cols: 1, rows: 2, colFractions: ones(1), rowFractions: ones(2), cells: gridCells(1, 2) },
  { id: "3x1", label: "3 colunas", cols: 3, rows: 1, colFractions: ones(3), rowFractions: ones(1), cells: gridCells(3, 1) },
  { id: "1x3", label: "3 linhas", cols: 1, rows: 3, colFractions: ones(1), rowFractions: ones(3), cells: gridCells(1, 3) },
  { id: "3x3", label: "3 × 3", cols: 3, rows: 3, colFractions: ones(3), rowFractions: ones(3), cells: gridCells(3, 3) },
  {
    id: "1+2",
    label: "1 + 2 (esq. grande)",
    cols: 2,
    rows: 2,
    colFractions: ones(2),
    rowFractions: ones(2),
    cells: [
      { col: 0, row: 0, rowSpan: 2 },
      { col: 1, row: 0 },
      { col: 1, row: 1 },
    ],
  },
  {
    id: "2+1",
    label: "2 + 1 (baixo largo)",
    cols: 2,
    rows: 2,
    colFractions: ones(2),
    rowFractions: ones(2),
    cells: [
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 0, row: 1, colSpan: 2 },
    ],
  },
];

export const DEFAULT_GRID_PRESET_ID = "2x2";

export function findGridPreset(id: string): GridPreset {
  return GRID_PRESETS.find((p) => p.id === id) ?? GRID_PRESETS[0];
}

// Builds the cell list for a preset, drawing fresh unique slotIds from `taken`
// (which is mutated so repeated calls in one build stay unique).
export function presetCells(preset: GridPreset, taken: Set<string>): GridCell[] {
  return preset.cells.map(({ col, row, colSpan, rowSpan }) => {
    let n = 1;
    while (taken.has(`cell_${n}`)) n++;
    const slotId = `cell_${n}`;
    taken.add(slotId);
    return {
      slotId,
      col,
      row,
      ...(colSpan ? { colSpan } : {}),
      ...(rowSpan ? { rowSpan } : {}),
    };
  });
}
