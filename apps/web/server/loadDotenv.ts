/**
 * Loads `.env` from repo root and `apps/api` using paths relative to this file so it works
 * whether the process cwd is the monorepo root, `apps/api`, or elsewhere (tsx vs `dist/`).
 */
import fs from "fs"
import path from "path"
import dotenv from "dotenv"

export function loadDotenv(): void {
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

  const seen = new Set<string>()
  for (const f of files) {
    const key = path.normalize(f)
    if (seen.has(key)) continue
    seen.add(key)
    if (fs.existsSync(f)) {
      dotenv.config({ path: f, override: true })
    }
  }
}
