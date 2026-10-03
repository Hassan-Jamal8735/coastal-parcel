import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set — add it to .env.local (see .env.example).");
}

// Neon's HTTP driver in production (made for serverless); plain Postgres for
// local development. Typed as the Neon client so code can't accidentally rely
// on interactive transactions, which the HTTP driver doesn't support — use
// db.batch() for multi-statement writes instead.
export const db = (
  url.includes("neon.tech")
    ? drizzleNeon(neon(url), { schema })
    : drizzlePg(new Pool({ connectionString: url }), { schema })
) as NeonHttpDatabase<typeof schema>;
