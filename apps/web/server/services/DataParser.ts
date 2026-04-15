/**
 * @file DataParser.ts
 * @description Parses TBC feed **plain text** into typed domain objects.
 *
 * **Feed format:** Each feed is one long document where logical rows are separated by
 * HTML `<br>` tags; each row is comma-separated CSV (with possible quoted fields).
 * The first row is a header; column names are normalized to **camelCase** via
 * {@link toCamelCase} for consistent lookups (`playerid`, `tranxDate`, etc.).
 *
 * **Purpose:** Bridge between `ApiSyncTBC` raw strings and Prisma upserts:
 * - `parseTransactions` → `Transaction[]` (join key: TBC `playerid`)
 * - `parseBatting` / `parsePitching` → stat lines per player and season
 * - `parsePlayersFrom*` + {@link normalizePlayer} → `Player[]` for the `players` table
 *
 * **Usage:** Called from `syncPipeline.ts` after raw snapshots are stored. Not used
 * from HTTP handlers; the browser never receives raw feed text.
 */

import { createHash } from "crypto"
import { extractHighLevelRawCell, parseExperienceLevelFromText } from "@available-player-portal/shared"

import {
  parseBatHandFromPlayerRow,
  parseThrowHandFromPlayerRow,
} from "@available-player-portal/shared"
import type { BattingStats, PitchingStats, Player, Transaction } from "../types/models"

/** Split TBC feed into logical rows (CSV lines separated by `<br>`). */
function splitFeedRows(raw: string): string[] {
  return raw
    .split(/<br\s*\/?>/gi)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * Minimal CSV line parser (handles quoted fields so commas inside quotes do not split).
 * Exported for tests or tooling that need to parse a single line.
 */
export function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (!inQuotes && c === ",") {
      out.push(cur)
      cur = ""
      continue
    }
    cur += c
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

/** Normalizes header labels like `tranx date` or `Bavg` to camelCase keys. */
function toCamelCase(raw: string): string {
  const key = raw.replace(/^\uFEFF/, "").trim()
  const k = key.replace(/[^a-zA-Z0-9]+/g, " ").trim().split(/\s+/)
  if (k.length === 0) return key
  return k
    .map((part, i) => {
      const lower = part.toLowerCase()
      if (i === 0) return lower
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join("")
}

/**
 * TBC transaction feed places `highlevel` immediately before `playerid`:
 * `...,age,highlevel,playerid` (values: MLB, AA, A+, A, AAA, Rk, …).
 */
function findHighLevelColumnIndex(header: string[]): number {
  return header.findIndex((h) => {
    const k = toCamelCase(h)
    return k === "highlevel" || k === "highLevel" || k === "highestLevel"
  })
}

function parseHeaderRow(line: string): string[] {
  return parseCsvLine(line)
}

function rowToRecord(header: string[], cells: string[]): Record<string, string> {
  const o: Record<string, string> = {}
  for (let i = 0; i < header.length; i++) {
    const key = toCamelCase(header[i])
    o[key] = cells[i] ?? ""
  }
  return o
}

function findSeasonTeamColumnIndex(header: string[]): number {
  const keys = new Set([
    "team",
    "teamname",
    "tm",
    "org",
    "orgname",
    "organization",
    "club",
    "clubname",
  ])
  for (let i = 0; i < header.length; i++) {
    const k = toCamelCase(header[i] ?? "").toLowerCase()
    if (keys.has(k)) return i
  }
  return -1
}

function extractSeasonTeamName(
  record: Record<string, string>,
  header: string[],
  cells: string[],
): string | null {
  const direct = (record.team || record.teamName || record.tm || record.org || record.orgName || "").trim()
  if (direct) return direct
  const idx = findSeasonTeamColumnIndex(header)
  if (idx >= 0 && idx < cells.length) {
    const v = String(cells[idx] ?? "").trim()
    if (v) return v
  }
  return null
}

/** Parses US-style `M/D/YYYY` dates from the transaction feed to `YYYY-MM-DD`. */
function parseUsDateToIso(s: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim())
  if (!m) return null
  const y = Number(m[3])
  const mo = Number(m[1])
  const d = Number(m[2])
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (Number.isNaN(dt.getTime())) return null
  return dt.toISOString().slice(0, 10)
}

/** Maps TBC `statusshort` (e.g. Active, Free Agt) to portal `Player.status` values. */
function mapStatusShort(statusshort: string): Player["status"] {
  const u = statusshort.toLowerCase()
  if (u.includes("injur")) return "injured"
  if (
    u.includes("free") ||
    u.includes("retir") ||
    u === "dfa" ||
    u.includes("released") ||
    u.includes("signed")
  ) {
    return "signed"
  }
  return "available"
}

/** TBC often sends age as `29.155`; we store integer years via `Math.floor`. */
function parseAgeCell(age: string): number | null {
  const n = parseFloat(age)
  if (Number.isNaN(n)) return null
  return Math.floor(n)
}

/**
 * Stateless parser. Safe to reuse across sync runs.
 */
export class DataParser {
  /**
   * Builds one {@link Player} per transaction row (same feed as {@link parseTransactions}).
   * Duplicate IDs are merged later in `mergePlayers` (sync pipeline).
   */
  parsePlayersFromTransactionFeed(raw: string): Player[] {
    const rows = splitFeedRows(raw)
    if (rows.length < 2) return []
    const header = parseHeaderRow(rows[0])
    const highlevelCol = findHighLevelColumnIndex(header)
    const out: Player[] = []
    for (let i = 1; i < rows.length; i++) {
      const cells = parseCsvLine(rows[i])
      if (cells.length < header.length) continue
      const r = rowToRecord(header, cells)
      const rec: Record<string, unknown> = { ...r }
      if (highlevelCol >= 0 && highlevelCol < cells.length) {
        rec.highlevel = String(cells[highlevelCol] ?? "").trim()
      }
      out.push(this.normalizePlayer(rec))
    }
    return out
  }

  /** Derives players from batting rows (name/team/position/age from stat feed). */
  parsePlayersFromBattingFeed(raw: string): Player[] {
    const rows = splitFeedRows(raw)
    if (rows.length < 2) return []
    const header = parseHeaderRow(rows[0])
    const out: Player[] = []
    for (let i = 1; i < rows.length; i++) {
      const cells = parseCsvLine(rows[i])
      if (cells.length < header.length) continue
      const r = rowToRecord(header, cells)
      out.push(this.normalizePlayer({ ...r }))
    }
    return out
  }

  /** Same row shape as batting; reuses {@link parsePlayersFromBattingFeed}. */
  parsePlayersFromPitchingFeed(raw: string): Player[] {
    return this.parsePlayersFromBattingFeed(raw)
  }

  /** Transaction history lines keyed by `playerid` + `tranx date` + type + description. */
  parseTransactions(raw: string): Transaction[] {
    const rows = splitFeedRows(raw)
    if (rows.length < 2) return []
    const header = parseHeaderRow(rows[0])
    const out: Transaction[] = []
    for (let i = 1; i < rows.length; i++) {
      const cells = parseCsvLine(rows[i])
      if (cells.length < header.length) continue
      const r = rowToRecord(header, cells)
      const playerId = (r.playerid || r.playerId || "").trim()
      if (!playerId) continue
      const dateStr = r.tranxDate || r.tranxdate || ""
      const iso = parseUsDateToIso(dateStr)
      if (!iso) continue
      out.push({
        playerId,
        date: iso,
        type: (r.tranxType || r.tranxtype || "").trim() || "unknown",
        description: (r.description || "").trim(),
      })
    }
    return out
  }

  /** One row per player-season batting line (MLB/minors aggregated in feed). */
  parseBatting(raw: string): BattingStats[] {
    const rows = splitFeedRows(raw)
    if (rows.length < 2) return []
    const header = parseHeaderRow(rows[0])
    const out: BattingStats[] = []
    for (let i = 1; i < rows.length; i++) {
      const cells = parseCsvLine(rows[i])
      if (cells.length < header.length) continue
      const r = rowToRecord(header, cells)
      const playerId = (r.playerid || r.playerId || "").trim()
      const year = parseInt(String(r.year || ""), 10)
      if (!playerId || Number.isNaN(year)) continue
      const teamName = extractSeasonTeamName(r, header, cells)
      const avg = parseFloat(String(r.bavg ?? r.Bavg ?? "0"))
      const obp = parseFloat(String(r.obp ?? "0"))
      const slg = parseFloat(String(r.slg ?? r.Slg ?? "0"))
      const ops = parseFloat(String(r.ops ?? r.OPS ?? "0"))
      const bb = parseInt(String(r.bb ?? r.BB ?? "0"), 10)
      out.push({
        playerId,
        season: year,
        teamName,
        avg: Number.isFinite(avg) ? avg : 0,
        obp: Number.isFinite(obp) ? obp : 0,
        slg: Number.isFinite(slg) ? slg : 0,
        ops: Number.isFinite(ops) ? ops : 0,
        bb: Number.isFinite(bb) ? bb : 0,
      })
    }
    return out
  }

  /** One row per player-season pitching line; strikeouts from `SO` column. */
  parsePitching(raw: string): PitchingStats[] {
    const rows = splitFeedRows(raw)
    if (rows.length < 2) return []
    const header = parseHeaderRow(rows[0])
    const out: PitchingStats[] = []
    for (let i = 1; i < rows.length; i++) {
      const cells = parseCsvLine(rows[i])
      if (cells.length < header.length) continue
      const r = rowToRecord(header, cells)
      const playerId = (r.playerid || r.playerId || "").trim()
      const year = parseInt(String(r.year || ""), 10)
      if (!playerId || Number.isNaN(year)) continue
      const teamName = extractSeasonTeamName(r, header, cells)
      const g = parseInt(String(r.g ?? r.G ?? "0"), 10)
      const era = parseFloat(String(r.era ?? "0"))
      const whip = parseFloat(String(r.whip ?? "0"))
      const ip = parseFloat(String(r.ip ?? r.IP ?? "0"))
      const k = parseInt(String(r.so ?? r.SO ?? "0"), 10)
      const bb = parseInt(String(r.bb ?? r.BB ?? "0"), 10)
      out.push({
        playerId,
        season: year,
        teamName,
        g: Number.isFinite(g) ? g : 0,
        era: Number.isFinite(era) ? era : 0,
        whip: Number.isFinite(whip) ? whip : 0,
        ip: Number.isFinite(ip) ? ip : 0,
        k: Number.isFinite(k) ? k : 0,
        bb: Number.isFinite(bb) ? bb : 0,
      })
    }
    return out
  }

  /**
   * Normalizes a header-keyed row into a {@link Player}. Used for all three feeds.
   * If `playerid` is missing, generates a deterministic `anon-*` id from name+team
   * so rows can still be upserted without colliding across runs.
   */
  normalizePlayer(raw: Record<string, unknown>): Player {
    const s = (k: string) => String(raw[k] ?? "").trim()
    let id = s("playerid") || s("playerId") || s("id")
    const name =
      s("player") ||
      [s("firstName"), s("lastName")].filter(Boolean).join(" ").trim() ||
      s("name") ||
      "Unknown"
    const position = expandPosition(s("position") || s("posit") || "")
    const team = s("team") || s("teamName") || ""
    const statusRaw = s("statusshort") || s("statusShort") || s("status")
    const status = statusRaw ? mapStatusShort(statusRaw) : "available"
    const ageRaw = s("age") || s("Age")
    const age = ageRaw ? parseAgeCell(ageRaw) : null
    const levelCell =
      extractHighLevelRawCell(raw) ||
      s("level") ||
      s("orgLevel") ||
      s("orglevel") ||
      s("league") ||
      ""
    let experienceLevel = levelCell ? parseExperienceLevelFromText(levelCell) : undefined
    if (experienceLevel == null && team) {
      experienceLevel = parseExperienceLevelFromText(team)
    }
    if (!id) {
      id = `anon-${createHash("sha256").update(`${name}|${team}`).digest("hex").slice(0, 16)}`
    }
    const bats = parseBatHandFromPlayerRow(raw)
    const throws = parseThrowHandFromPlayerRow(raw)
    return {
      id,
      name,
      position: position || "—",
      team: team || "—",
      status,
      age: age ?? undefined,
      experienceLevel,
      bats,
      throws,
    }
  }
}

/** Expands short codes (`P`, `p`) to UI-friendly labels like `Pitcher` for filters. */
function expandPosition(p: string): string {
  const u = p.toLowerCase()
  if (u === "p" || u.startsWith("p-")) return "Pitcher"
  if (u === "c") return "Catcher"
  if (u.includes("pitch")) return "Pitcher"
  return p || "—"
}
