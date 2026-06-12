// Creates the templates table (spec §28) on the Neon database.
// Usage: npm run db:init  (reads DATABASE_URL from .env.local)
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env.local first.");
  process.exit(1);
}

const sql = neon(url);

await sql`
  CREATE TABLE IF NOT EXISTS templates (
    id text PRIMARY KEY,
    name text NOT NULL,
    version integer NOT NULL,
    category text,
    premium boolean NOT NULL DEFAULT false,
    thumbnail_url text,
    template_json jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`;

const [{ count }] = await sql`SELECT count(*)::int AS count FROM templates`;
console.log(`OK — "templates" table ready (${count} row(s)).`);
