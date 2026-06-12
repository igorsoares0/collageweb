import { CANVAS_FORMATS } from "./factory";
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
  }

  if (!Array.isArray(value.layers)) {
    errors.push('"layers" must be an array');
    return { valid: errors.length === 0, errors };
  }

  const layerIds = new Set<string>();
  const slotIds = new Set<string>();

  value.layers.forEach((layer: unknown, i: number) => {
    const label = `layers[${i}]`;
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

  return { valid: errors.length === 0, errors };
}

export function isTemplate(value: unknown): value is Template {
  return validateTemplate(value).valid;
}
