#!/usr/bin/env node
/**
 * Runs Prisma CLI with env vars from repo root `.env` or `apps/api/.env`.
 * Paths are resolved from this script's location so `DATABASE_URL` is found even when
 * `process.cwd()` is the monorepo root, `apps/api`, or another tool changes cwd.
 */
const path = require("path")
const fs = require("fs")
const { spawnSync } = require("child_process")

const apiRoot = path.join(__dirname, "..")
const repoRoot = path.join(__dirname, "..", "..", "..")
const cwd = process.cwd()

const files = [
  path.join(repoRoot, ".env"),
  path.join(apiRoot, ".env"),
  path.join(cwd, ".env"),
  path.resolve(cwd, "../../.env"),
]
if (fs.existsSync(path.join(cwd, "apps", "api"))) {
  files.push(path.join(cwd, ".env"), path.join(cwd, "apps", "api", ".env"))
}

const seen = new Set()
for (const f of files) {
  const key = path.normalize(f)
  if (seen.has(key)) continue
  seen.add(key)
  if (fs.existsSync(f)) {
    require("dotenv").config({ path: f, override: true })
  }
}

const prismaArgs = process.argv.slice(2)
const prismaCmd = prismaArgs[0]
const needsDatabaseUrl =
  prismaCmd !== "generate" &&
  prismaCmd !== "format" &&
  prismaCmd !== "version" &&
  prismaCmd !== "--version"

if (needsDatabaseUrl && !process.env.DATABASE_URL?.trim()) {
  console.error(
    "\n[prisma-with-env] DATABASE_URL is not set.\n" +
      "  1. Copy .env.example to .env at the repo root (or apps/api/.env).\n" +
      "  2. Point DATABASE_URL at local Postgres (see README → Database), e.g.\n" +
      "     postgresql://user:password@localhost:5432/available_player_portal\n" +
      "  3. Optional Docker DB: docker compose -f docker-compose.dev.yml up -d\n",
  )
  process.exit(1)
}
const result = spawnSync("npx", ["prisma", ...prismaArgs], {
  stdio: "inherit",
  cwd: apiRoot,
  env: process.env,
  shell: true,
})
process.exit(result.status === null ? 1 : result.status)
