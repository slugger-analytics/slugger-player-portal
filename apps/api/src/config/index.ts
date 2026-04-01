/**
 * @file config/index.ts
 * @description Centralized **runtime configuration** for the API process.
 *
 * **Environment variables:**
 * - `PORT` — HTTP listen port (default 4000)
 * - `DATABASE_URL` — PostgreSQL connection string for Prisma
 * - `TBC_FEED_PASSWORD` — Baseball Cube feed password (**server-only**; never `NEXT_PUBLIC_*`)
 */

import { loadDotenv } from "../loadDotenv"

loadDotenv()

export const config = {
  port: Number(process.env.PORT) || 4000,
  databaseUrl: process.env.DATABASE_URL ?? "",
  /** Server-only; never use NEXT_PUBLIC_ for this value. */
  tbcFeedPassword: process.env.TBC_FEED_PASSWORD ?? "jhu$",
}
