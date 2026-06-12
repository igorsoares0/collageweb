import { validateTemplate } from "@/lib/template/validate";
import type { Template } from "@/lib/template/types";

// Exports only the pure template JSON — exactly what Flutter consumes.
export function exportTemplate(template: Template) {
  const blob = new Blob([JSON.stringify(template, null, 2)], {
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
  const result = validateTemplate(parsed);
  if (!result.valid) {
    return { error: `Invalid template: ${result.errors.join("; ")}` };
  }
  return { template: parsed as Template };
}
