/**
 * @file PlayerAPI.ts
 * @description Express router for **Player Discovery** REST endpoints.
 *
 * **Routes (mounted at `/players` in `index.ts`):**
 * - `GET /` — query: `experienceLevel` (exact enum only), `experience_level`, `highlevel`, `highLevel`,
 *   `lastTransactionDays` (7 | 14 | 21 | 30 | 45 | 60), …
 * - `GET /:id` — full `PlayerProfile` (stats + embedded transactions)
 * - `GET /:id/transactions` — `Transaction[]` only (used by the web timeline component)
 *
 * **Important:** `/:id/transactions` is registered **before** `/:id` so Express does not
 * treat `transactions` as an `:id` capture.
 *
 * **Usage:** Frontend (`apps/web/lib/api.ts`) must be the only consumer of player data;
 * do not import repositories in Next.js code.
 */

import {
  type BatHand,
  isBatHandQueryValue,
  isLastTransactionDaysOption,
  isThrowHandQueryValue,
  type TransactionTypeFilter,
  type ThrowHand,
  parseExperienceLevelFilterInput,
} from "@available-player-portal/shared"
import { Router } from "express"
import type { PlayerFilters } from "../types/models"
import { PlayerDataService } from "../services/PlayerDataService"
import { PlayerRepository } from "../repositories/PlayerRepository"
import { TransactionRepository } from "../repositories/TransactionRepository"

const playerData = new PlayerDataService()
const playersRepo = new PlayerRepository()
/** Single-table read for the dedicated transactions endpoint (no cross-repo join). */
const transactions = new TransactionRepository()

/** Express `query` values can be string or string[]; normalize to a single string. */
function firstString(q: unknown): string | undefined {
  if (typeof q === "string") return q
  if (Array.isArray(q) && typeof q[0] === "string") return q[0]
  return undefined
}

function parseTransactionTypesQuery(query: Record<string, unknown>): TransactionTypeFilter[] | undefined {
  const raw = firstString(query.transactionTypes)
  if (raw == null || raw.trim() === "") return undefined
  const values = raw
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
  const out: TransactionTypeFilter[] = []
  for (const v of values) {
    if (v === "retired") out.push("retired")
    else if (v === "released") out.push("released")
    else if (v === "freeagent" || v === "free_agent" || v === "free-agent") out.push("freeAgent")
    else throw new Error("Invalid transactionTypes")
  }
  return out.length ? [...new Set(out)] : undefined
}

/** Maps `req.query` into {@link PlayerFilters}; throws if `ageMin`/`ageMax` are invalid. */
function parseFilters(query: Record<string, unknown>): PlayerFilters {
  const position = firstString(query.position)
  const status = firstString(query.status)
  const team = firstString(query.team)
  let ageMin: number | undefined
  let ageMax: number | undefined
  const ageMinRaw = firstString(query.ageMin) ?? (typeof query.ageMin === "number" ? String(query.ageMin) : undefined)
  const ageMaxRaw = firstString(query.ageMax) ?? (typeof query.ageMax === "number" ? String(query.ageMax) : undefined)
  if (ageMinRaw != null && ageMinRaw !== "") {
    ageMin = Number(ageMinRaw)
    if (Number.isNaN(ageMin)) throw new Error("Invalid ageMin")
  }
  if (ageMaxRaw != null && ageMaxRaw !== "") {
    ageMax = Number(ageMaxRaw)
    if (Number.isNaN(ageMax)) throw new Error("Invalid ageMax")
  }

  let limit: number | undefined
  const limitRaw = firstString(query.limit) ?? (typeof query.limit === "number" ? String(query.limit) : undefined)
  if (limitRaw != null && limitRaw !== "") {
    limit = Number(limitRaw)
    if (!Number.isInteger(limit) || limit < 1) throw new Error("Invalid limit")
    limit = Math.min(limit, 100)
  }

  let offset: number | undefined
  const offsetRaw = firstString(query.offset) ?? (typeof query.offset === "number" ? String(query.offset) : undefined)
  if (offsetRaw != null && offsetRaw !== "") {
    offset = Number(offsetRaw)
    if (!Number.isInteger(offset) || offset < 0) throw new Error("Invalid offset")
  }
  if (offset != null && offset > 0 && limit == null) {
    throw new Error("Invalid offset: use limit when offset is set")
  }

  let hasStats: boolean | undefined
  const hasStatsRaw = firstString(query.hasStats)
  if (hasStatsRaw != null && hasStatsRaw !== "") {
    const v = hasStatsRaw.toLowerCase()
    if (v === "true" || v === "1" || v === "yes") {
      hasStats = true
    } else if (v === "false" || v === "0" || v === "no") {
      hasStats = undefined
    } else {
      throw new Error("Invalid hasStats")
    }
  }

  const { value: experienceLevel, invalidRaw: exactInvalid } = parseExactExperienceLevelQuery(query)

  if (exactInvalid) {
    throw new Error(`Invalid experienceLevel: ${exactInvalid}`)
  }

  let sortBy: PlayerFilters["sortBy"]
  const sortByRaw = firstString(query.sortBy)?.trim().toLowerCase()
  if (sortByRaw != null && sortByRaw !== "") {
    if (sortByRaw === "name") sortBy = "name"
    else if (sortByRaw === "lastname" || sortByRaw === "last_name") sortBy = "lastName"
    else if (
      sortByRaw === "experiencelevel" ||
      sortByRaw === "experience_level" ||
      sortByRaw === "highlevel" ||
      sortByRaw === "high_level"
    ) {
      sortBy = "experienceLevel"
    } else if (
      sortByRaw === "recentprofiletransaction" ||
      sortByRaw === "recent_profile_transaction" ||
      sortByRaw === "profiletransaction" ||
      sortByRaw === "updates"
    ) {
      sortBy = "recentProfileTransaction"
    } else {
      throw new Error("Invalid sortBy")
    }
  }

  let sortDir: "asc" | "desc" | undefined
  const sortDirRaw = firstString(query.sortDir)?.trim().toLowerCase()
  if (sortDirRaw != null && sortDirRaw !== "") {
    if (sortDirRaw === "asc" || sortDirRaw === "desc") {
      sortDir = sortDirRaw
    } else {
      throw new Error("Invalid sortDir")
    }
  }

  let lastTransactionDays: number | undefined
  const ltdRaw =
    firstString(query.lastTransactionDays) ??
    (typeof query.lastTransactionDays === "number" ? String(query.lastTransactionDays) : undefined)
  if (ltdRaw != null && ltdRaw !== "") {
    const n = Number(ltdRaw)
    if (!Number.isInteger(n) || !isLastTransactionDaysOption(n)) {
      throw new Error("Invalid lastTransactionDays")
    }
    lastTransactionDays = n
  }

  let bats: PlayerFilters["bats"]
  const batsRaw = firstString(query.bats)
  if (batsRaw != null && batsRaw !== "") {
    if (!isBatHandQueryValue(batsRaw)) throw new Error("Invalid bats")
    bats = batsRaw.trim().toUpperCase() as BatHand
  }

  let throws: PlayerFilters["throws"]
  const throwsRaw = firstString(query.throws)
  if (throwsRaw != null && throwsRaw !== "") {
    if (!isThrowHandQueryValue(throwsRaw)) throw new Error("Invalid throws")
    throws = throwsRaw.trim().toUpperCase() as ThrowHand
  }
  const transactionTypes = parseTransactionTypesQuery(query)

  return {
    position,
    status,
    team,
    ageMin,
    ageMax,
    experienceLevel,
    hasStats,
    limit,
    offset,
    sortBy,
    sortDir,
    lastTransactionDays,
    transactionTypes,
    bats,
    throws,
  }
}

/** Exact level: UI sends `experienceLevel`; TBC-style URLs often use `highlevel` / `highLevel`. */
function parseExactExperienceLevelQuery(query: Record<string, unknown>): {
  value: string | undefined
  invalidRaw: string | undefined
} {
  // Same filter; multiple keys for HTTP clients (camelCase, snake_case, TBC-style).
  const keys = ["experienceLevel", "experience_level", "highlevel", "highLevel"] as const
  for (const key of keys) {
    const raw = firstString(query[key])
    if (raw == null || raw.trim() === "") continue
    const parsed = parseExperienceLevelFilterInput(raw)
    if (parsed) return { value: parsed, invalidRaw: undefined }
    return { value: undefined, invalidRaw: raw }
  }
  return { value: undefined, invalidRaw: undefined }
}

/** Factory so tests can mount the router without starting the full app. */
export function createPlayerRouter(): Router {
  const r = Router()

  r.get("/", async (req, res, next) => {
    try {
      const filters = parseFilters(req.query as Record<string, unknown>)
      const body = await playerData.listPlayerSummariesWithTotal(filters)
      res.json(body)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bad request"
      if (msg.startsWith("Invalid")) {
        res.status(400).json({ error: msg })
        return
      }
      next(e)
    }
  })

  r.get("/:id/transactions", async (req, res, next) => {
    try {
      const { id } = req.params
      const portal = await playersRepo.getPlayerById(id)
      if (!portal) {
        res.status(404).json({ error: "Player not found" })
        return
      }
      const list = await transactions.getTransactionsByPlayer(id)
      res.json(list)
    } catch (e) {
      next(e)
    }
  })

  r.get("/:id", async (req, res, next) => {
    try {
      const { id } = req.params
      const profile = await playerData.buildPlayerProfile(id)
      if (!profile) {
        res.status(404).json({ error: "Player not found" })
        return
      }
      res.json(profile)
    } catch (e) {
      next(e)
    }
  })

  return r
}
