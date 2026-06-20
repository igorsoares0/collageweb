import { validateTemplate } from "@/lib/template/validate";
import { serializeTemplate } from "@/lib/template/factory";
import type { Template } from "@/lib/template/types";

// Exports the wire JSON Flutter consumes: single-panel templates as classic
// v1, multi-panel as v2 (see serializeTemplate).
export function exportTemplate(template: Template) {
  const wire = serializeTemplate(template);
  const blob = new Blob([JSON.stringify(wire, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${template.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importTemplateFile(
  file: File
): Promise<{ template: Template } | { error: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return { error: "File is not valid JSON" };
  }
  // Files exported before schemaVersion existed are schema 1 by definition;
  // a "panels" array (multi-panel) implies the v2 contract.
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    obj.schemaVersion ??= Array.isArray(obj.panels) ? 2 : 1;
  }
  const result = validateTemplate(parsed);
  if (!result.valid) {
    return { error: `Invalid template: ${result.errors.join("; ")}` };
  }
  return { template: parsed as Template };
}
