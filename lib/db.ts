import { neon } from "@neondatabase/serverless";

// Server-only. Route handlers are the sole consumers; the browser talks to
// them through ApiTemplateRepository.
export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}
