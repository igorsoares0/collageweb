import { CANVAS_FORMATS } from "./factory";
import { CURRENT_SCHEMA_VERSION } from "./types";
import type { AspectRatio, Template } from "./types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const ASPECT_RATIOS = Object.keys(CANVAS_FORMATS) as AspectRatio[];
const ALIGNMENTS = ["left", "center", "right"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function checkNumbers(
  layer: Record<string, unknown>,
  fields: string[],
  label: string,
  errors: string[]
) {
  for (const f of fields) {
    if (!isFiniteNumber(layer[f])) {
      errors.push(`${label}: "${f}" must be a number`);
    }
  }
}

// Spec §24: template must contain id, version, name, canvas, layers —
// plus structural sanity per layer type (§8–11).
export function validateTemplate(value: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { valid: false, errors: ["Template must be a JSON object"] };
  }

  if (!isNonEmptyString(value.id)) errors.push('"id" must be a non-empty string');
  if (!isNonEmptyString(value.name)) errors.push('"name" must be a non-empty string');
  if (
    !isFiniteNumber(value.version) ||
    !Number.isInteger(value.version) ||
    value.version < 0
  ) {
    errors.push('"version" must be a non-negative integer');
  }

  if (
    !isFiniteNumber(value.schemaVersion) ||
    !Number.isInteger(value.schemaVersion) ||
    value.schemaVersion < 1
  ) {
    errors.push('"schemaVersion" must be a positive integer');
  } else if (value.schemaVersion > CURRENT_SCHEMA_VERSION) {
    errors.push(
      `"schemaVersion" ${value.schemaVersion} is newer than this editor supports (${CURRENT_SCHEMA_VERSION})`
    );
  }

  if (
    typeof value.aspectRatio !== "string" ||
    !ASPECT_RATIOS.includes(value.aspectRatio as AspectRatio)
  ) {
    errors.push(`"aspectRatio" must be one of: ${ASPECT_RATIOS.join(", ")}`);
  } else if (isRecord(value.canvas)) {
    const expected = CANVAS_FORMATS[value.aspectRatio as AspectRatio];
    if (
      value.canvas.width !== expected.width ||
      value.canvas.height !== expected.height
    ) {
      errors.push(
        `"canvas" must be ${expected.width}x${expected.height} for aspectRatio "${value.aspectRatio}"`
      );
    }
  }

  if (
    !isRecord(value.canvas) ||
    !isFiniteNumber(value.canvas.width) ||
    !isFiniteNumber(value.canvas.height) ||
    value.canvas.width <= 0 ||
    value.canvas.height <= 0
  ) {
    errors.push('"canvas" must have positive numeric width and height');
  } else if (
    value.canvas.backgroundColor !== undefined &&
    !isNonEmptyString(value.canvas.backgroundColor)
  ) {
    // Optional (older templates predate it); must be a string when present.
    errors.push('"canvas.backgroundColor" must be a non-empty string');
  }

  // ids and slotIds are unique across the whole template (every panel shares
  // one namespace, since the app keys user content by slotId globally).
  const layerIds = new Set<string>();
  const slotIds = new Set<string>();
  // A grid layer is a schemaVersion-3 feature; track whether one appears so we
  // can reject it under an older declared version.
  const flags = { hasGrid: false };

  if (Array.isArray(value.panels)) {
    // v2 multi-panel shape.
    const panelIds = new Set<string>();
    value.panels.forEach((panel: unknown, p: number) => {
      const plabel = `panels[${p}]`;
      if (!isRecord(panel)) {
        errors.push(`${plabel}: must be an object`);
        return;
      }
      if (!isNonEmptyString(panel.id)) {
        errors.push(`${plabel}: "id" must be a non-empty string`);
      } else if (panelIds.has(panel.id)) {
        errors.push(`${plabel}: duplicate panel id "${panel.id}"`);
      } else {
        panelIds.add(panel.id);
      }
      if (!isNonEmptyString(panel.backgroundColor)) {
        errors.push(`${plabel}: "backgroundColor" must be a non-empty string`);
      }
      if (!Array.isArray(panel.layers)) {
        errors.push(`${plabel}: "layers" must be an array`);
        return;
      }
      validateLayers(panel.layers, `${plabel}.layers`, layerIds, slotIds, flags, errors);
    });
  } else if (Array.isArray(value.layers)) {
    // Classic v1 single-canvas shape.
    validateLayers(value.layers, "layers", layerIds, slotIds, flags, errors);
  } else {
    errors.push('"layers" must be an array (or provide "panels")');
  }

  if (flags.hasGrid && isFiniteNumber(value.schemaVersion) && value.schemaVersion < 3) {
    errors.push('a "grid" layer requires "schemaVersion" 3 or higher');
  }

  return { valid: errors.length === 0, errors };
}

// Validates a stack of layers, accumulating id/slotId uniqueness into the
// shared sets so collisions are caught across every panel.
// Registers a slotId, flagging duplicates across the shared namespace.
function registerSlotId(
  slotId: unknown,
  label: string,
  slotIds: Set<string>,
  errors: string[]
) {
  if (!isNonEmptyString(slotId)) return;
  if (slotIds.has(slotId)) {
    errors.push(`${label}: duplicate slotId "${slotId}"`);
  } else {
    slotIds.add(slotId);
  }
}

function validateLayers(
  layers: unknown[],
  prefix: string,
  layerIds: Set<string>,
  slotIds: Set<string>,
  flags: { hasGrid: boolean },
  errors: string[]
) {
  layers.forEach((layer: unknown, i: number) => {
    const label = `${prefix}[${i}]`;
    if (!isRecord(layer)) {
      errors.push(`${label}: must be an object`);
      return;
    }

    if (!isNonEmptyString(layer.id)) {
      errors.push(`${label}: "id" must be a non-empty string`);
    } else if (layerIds.has(layer.id)) {
      errors.push(`${label}: duplicate layer id "${layer.id}"`);
    } else {
      layerIds.add(layer.id);
    }

    switch (layer.type) {
      case "image": {
        if (!isNonEmptyString(layer.slotId)) {
          errors.push(`${label}: image layer requires a non-empty "slotId"`);
        }
        checkNumbers(
          layer,
          ["x", "y", "width", "height", "rotation", "opacity", "borderRadius"],
          label,
          errors
        );
        if (
          isFiniteNumber(layer.opacity) &&
          (layer.opacity < 0 || layer.opacity > 1)
        ) {
          errors.push(`${label}: "opacity" must be between 0 and 1`);
        }
        // Optional decorative frame; a string id when present (the catalog it
        // references may gain entries after a template is authored, so we don't
        // pin it to the known set here).
        if (
          layer.frameAssetId !== undefined &&
          !isNonEmptyString(layer.frameAssetId)
        ) {
          errors.push(`${label}: "frameAssetId" must be a non-empty string`);
        }
        break;
      }
      case "text": {
        if (!isNonEmptyString(layer.slotId)) {
          errors.push(`${label}: text layer requires a non-empty "slotId"`);
        }
        checkNumbers(layer, ["x", "y", "width", "fontSize", "fontWeight"], label, errors);
        if (!isNonEmptyString(layer.fontFamily)) {
          errors.push(`${label}: "fontFamily" must be a non-empty string`);
        }
        if (!isNonEmptyString(layer.color)) {
          errors.push(`${label}: "color" must be a non-empty string`);
        }
        if (
          typeof layer.alignment !== "string" ||
          !ALIGNMENTS.includes(layer.alignment)
        ) {
          errors.push(`${label}: "alignment" must be one of: ${ALIGNMENTS.join(", ")}`);
        }
        break;
      }
      case "shape": {
        if (layer.shape !== "rectangle") {
          errors.push(`${label}: "shape" must be "rectangle"`);
        }
        if (!isNonEmptyString(layer.fill)) {
          errors.push(`${label}: "fill" must be a non-empty string`);
        }
        checkNumbers(layer, ["x", "y", "width", "height"], label, errors);
        break;
      }
      case "sticker": {
        if (!isNonEmptyString(layer.assetId)) {
          errors.push(`${label}: sticker layer requires a non-empty "assetId"`);
        }
        checkNumbers(layer, ["x", "y", "width", "height"], label, errors);
        break;
      }
      case "grid": {
        flags.hasGrid = true;
        validateGrid(layer, label, slotIds, errors);
        break;
      }
      default:
        errors.push(
          `${label}: unknown layer type "${String((layer as Record<string, unknown>).type)}"`
        );
    }

    if (isNonEmptyString(layer.slotId)) {
      if (slotIds.has(layer.slotId)) {
        errors.push(`${label}: duplicate slotId "${layer.slotId}"`);
      } else {
        slotIds.add(layer.slotId);
      }
    }
  });
}

function isPositiveInt(v: unknown): v is number {
  return isFiniteNumber(v) && Number.isInteger(v) && v > 0;
}

// A grid layer (§ schemaVersion 3): a placeable box tiled into fraction tracks
// with per-cell photo slots. Fractions must match cols/rows; cells must sit
// inside the track grid; cell slotIds join the shared slot namespace.
function validateGrid(
  layer: Record<string, unknown>,
  label: string,
  slotIds: Set<string>,
  errors: string[]
) {
  checkNumbers(layer, ["x", "y", "width", "height", "rotation", "gutter", "cornerRadius"], label, errors);

  const cols = layer.cols;
  const rows = layer.rows;
  if (!isPositiveInt(cols)) errors.push(`${label}: "cols" must be a positive integer`);
  if (!isPositiveInt(rows)) errors.push(`${label}: "rows" must be a positive integer`);

  const checkFractions = (fractions: unknown, count: unknown, name: string) => {
    if (!Array.isArray(fractions)) {
      errors.push(`${label}: "${name}" must be an array`);
      return;
    }
    if (isPositiveInt(count) && fractions.length !== count) {
      errors.push(`${label}: "${name}" length must equal ${String(count)}`);
    }
    if (!fractions.every((f) => isFiniteNumber(f) && f > 0)) {
      errors.push(`${label}: "${name}" must be positive numbers`);
    }
  };
  checkFractions(layer.colFractions, cols, "colFractions");
  checkFractions(layer.rowFractions, rows, "rowFractions");

  if (layer.gutterColor !== undefined && !isNonEmptyString(layer.gutterColor)) {
    errors.push(`${label}: "gutterColor" must be a non-empty string`);
  }

  if (!Array.isArray(layer.cells) || layer.cells.length === 0) {
    errors.push(`${label}: "cells" must be a non-empty array`);
    return;
  }
  layer.cells.forEach((cell: unknown, i: number) => {
    const clabel = `${label}.cells[${i}]`;
    if (!isRecord(cell)) {
      errors.push(`${clabel}: must be an object`);
      return;
    }
    registerSlotId(cell.slotId, clabel, slotIds, errors);
    if (!isNonEmptyString(cell.slotId)) {
      errors.push(`${clabel}: cell requires a non-empty "slotId"`);
    }
    const col = cell.col;
    const row = cell.row;
    const colSpan = cell.colSpan ?? 1;
    const rowSpan = cell.rowSpan ?? 1;
    if (!isFiniteNumber(col) || !Number.isInteger(col) || col < 0) {
      errors.push(`${clabel}: "col" must be a non-negative integer`);
    } else if (isPositiveInt(cols) && (!isPositiveInt(colSpan) || col + colSpan > cols)) {
      errors.push(`${clabel}: cell exceeds the column grid`);
    }
    if (!isFiniteNumber(row) || !Number.isInteger(row) || row < 0) {
      errors.push(`${clabel}: "row" must be a non-negative integer`);
    } else if (isPositiveInt(rows) && (!isPositiveInt(rowSpan) || row + rowSpan > rows)) {
      errors.push(`${clabel}: cell exceeds the row grid`);
    }
    if (cell.borderRadius !== undefined && !isFiniteNumber(cell.borderRadius)) {
      errors.push(`${clabel}: "borderRadius" must be a number`);
    }
  });
}

export function isTemplate(value: unknown): value is Template {
  return validateTemplate(value).valid;
}
