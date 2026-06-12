import type { TemplateRepository } from "./TemplateRepository";
import { ApiTemplateRepository } from "./apiRepository";
import { LocalStorageTemplateRepository } from "./localStorageRepository";

let repository: TemplateRepository | null = null;

// NEXT_PUBLIC_USE_NEON=true routes persistence through /api/templates (Neon);
// otherwise templates stay in localStorage (no backend needed).
export function getRepository(): TemplateRepository {
  repository ??=
    process.env.NEXT_PUBLIC_USE_NEON === "true"
      ? new ApiTemplateRepository()
      : new LocalStorageTemplateRepository();
  return repository;
}
