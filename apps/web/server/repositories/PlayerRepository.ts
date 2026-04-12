/**
 * @file PlayerRepository.ts
 * @description Data access for the `players` table — **single-table only** (no joins).
 *
 * **Purpose:** Load players for discovery filters (`getPlayers`) and upsert rows during
 * sync (`upsertPlayers`). Position filter treats “Pitcher” as shorthand for `P`, `p-`,
 * or text containing “Pitch” so UI filters match TBC’s short codes.
 *
 * **Usage:** Called from `PlayerDataService` and `syncPipeline.ts` (never from routes
 * directly; keep HTTP layer thin).
 */

import { isExperienceLevelCode } from "@available-player-portal/shared"
import type { ExperienceLevel } from "@prisma/client"
import { Prisma } from "@prisma/client"
import type { Player, PlayerFilters } from "../types/models"
import { prisma } from "../lib/prisma"
import { isPlayerDiscoveryEligible } from "../utils/playerEligibility"

const DISCOVERY_SCAN_BATCH = 400
/** Stop scanning after this many DB rows to avoid unbounded reads (raise if your roster is larger). */
const DISCOVERY_SCAN_MAX_ROWS = 200_000

export class PlayerRepository {
  /** Flat `AND` clauses — avoids Prisma mis-combining `OR`/`NOT` (position) with `experienceLevel`. */
  private collectDiscoveryWhereClauses(filters: PlayerFilters): Prisma.PlayerWhereInput[] {
    const clauses: Prisma.PlayerWhereInput[] = []
    if (filters.position) {
      const raw = filters.position.trim()
      const fp = raw.toLowerCase()
      const pitcherMatch: Prisma.PlayerWhereInput[] = [
        { position: { contains: "Pitch", mode: "insensitive" } },
        { position: { equals: "p", mode: "insensitive" } },
        { position: { startsWith: "p-", mode: "insensitive" } },
      ]
      if (fp === "non-p") {
        clauses.push({ NOT: { OR: pitcherMatch } })
      } else if (fp === "p" || fp.includes("pitch")) {
        clauses.push({ OR: pitcherMatch })
      } else {
        clauses.push({ position: { contains: raw, mode: "insensitive" } })
      }
    }
    if (filters.status) {
      clauses.push({ status: filters.status as string })
    }
    if (filters.team) {
      clauses.push({ team: { contains: filters.team, mode: "insensitive" } })
    }
    if (filters.ageMin != null || filters.ageMax != null) {
      const age: Prisma.IntFilter = {}
      if (filters.ageMin != null) age.gte = filters.ageMin
      if (filters.ageMax != null) age.lte = filters.ageMax
      clauses.push({ age })
    }
    if (filters.experienceLevel != null && filters.experienceLevel !== "") {
      const code = filters.experienceLevel
      if (!isExperienceLevelCode(code)) {
        throw new Error(`Invalid experienceLevel: ${code}`)
      }
      clauses.push({ experienceLevel: code as ExperienceLevel })
    }
    if (filters.hasStats) {
      clauses.push({
        OR: [{ battingStats: { some: {} } }, { pitchingStats: { some: {} } }],
      })
    }
    return clauses
  }

  private combineWhereClauses(clauses: Prisma.PlayerWhereInput[]): Prisma.PlayerWhereInput {
    if (clauses.length === 0) return {}
    if (clauses.length === 1) return clauses[0]!
    return { AND: clauses }
  }

  /** Shared `where` for `findMany` / `count` (does not use `limit` / `offset`). */
  private playerWhereFromFilters(filters: PlayerFilters): Prisma.PlayerWhereInput {
    return this.combineWhereClauses(this.collectDiscoveryWhereClauses(filters))
  }

  private orderByFromFilters(filters: PlayerFilters): Prisma.PlayerOrderByWithRelationInput[] {
    const sortBy = filters.sortBy ?? "name"
    const sortDir =
      filters.sortDir ?? (sortBy === "experienceLevel" ? ("desc" as const) : ("asc" as const))
    if (sortBy === "experienceLevel") {
      return [
        { experienceLevel: { sort: sortDir, nulls: "last" } },
        { name: "asc" },
      ]
    }
    return [{ name: sortDir }]
  }

  private mapRow(r: {
    id: string
    name: string
    position: string | null
    team: string | null
    status: string
    age: number | null
    experienceLevel: ExperienceLevel | null
  }): Player {
    return {
      id: r.id,
      name: r.name,
      position: r.position ?? "",
      team: r.team ?? "",
      status: r.status,
      age: r.age ?? undefined,
      experienceLevel: r.experienceLevel ?? undefined,
    }
  }

  /**
   * Scans DB rows in `name` order and counts those passing {@link isPlayerDiscoveryEligible}.
   * Omits junk ids (e.g. `000`) and non-name rows from mis-parsed TBC CSV.
   */
  async countPlayers(filters: PlayerFilters): Promise<number> {
    const where = this.playerWhereFromFilters(filters)
    const orderBy = { name: "asc" as const }
    let dbSkip = 0
    let eligible = 0
    while (dbSkip < DISCOVERY_SCAN_MAX_ROWS) {
      const batch = await prisma.player.findMany({
        where,
        orderBy,
        skip: dbSkip,
        take: DISCOVERY_SCAN_BATCH,
        select: { id: true, name: true },
      })
      if (batch.length === 0) break
      for (const row of batch) {
        if (isPlayerDiscoveryEligible(row)) eligible++
      }
      dbSkip += batch.length
      if (batch.length < DISCOVERY_SCAN_BATCH) break
    }
    return eligible
  }

  /**
   * Discovery list: same filters as before, but only **eligible** players (real names, plausible ids).
   * Pagination walks the filtered stream in `name` order (re-scans from the start for each request;
   * fine for typical roster sizes).
   */
  async getPlayers(filters: PlayerFilters): Promise<Player[]> {
    const where = this.playerWhereFromFilters(filters)
    const orderBy = this.orderByFromFilters(filters)
    if (filters.limit == null) {
      const rows = await prisma.player.findMany({ where, orderBy })
      return rows.map((r) => this.mapRow(r)).filter(isPlayerDiscoveryEligible)
    }
    const needEnd = (filters.offset ?? 0) + filters.limit
    let dbSkip = 0
    const eligible: Player[] = []
    while (eligible.length < needEnd && dbSkip < DISCOVERY_SCAN_MAX_ROWS) {
      const batch = await prisma.player.findMany({
        where,
        orderBy,
        skip: dbSkip,
        take: DISCOVERY_SCAN_BATCH,
      })
      if (batch.length === 0) break
      for (const row of batch) {
        const p = this.mapRow(row)
        if (isPlayerDiscoveryEligible(p)) eligible.push(p)
      }
      dbSkip += batch.length
      if (batch.length < DISCOVERY_SCAN_BATCH) break
    }
    return eligible.slice(filters.offset ?? 0, needEnd)
  }

  /** Lookup by primary key (`Player.id` = TBC `playerid`). */
  async getPlayerById(id: string): Promise<Player | null> {
    const r = await prisma.player.findUnique({ where: { id } })
    if (!r) return null
    return {
      id: r.id,
      name: r.name,
      position: r.position ?? "",
      team: r.team ?? "",
      status: r.status,
      age: r.age ?? undefined,
      experienceLevel: r.experienceLevel ?? undefined,
    }
  }

  /** Idempotent sync: same `id` updates name/team/status/age/experience without duplicating rows. */
  async upsertPlayers(players: Player[]): Promise<void> {
    for (const p of players) {
      const experienceLevel =
        p.experienceLevel != null && p.experienceLevel !== ""
          ? (p.experienceLevel as ExperienceLevel)
          : null
      await prisma.player.upsert({
        where: { id: p.id },
        create: {
          id: p.id,
          name: p.name,
          position: p.position || null,
          team: p.team || null,
          status: p.status,
          age: p.age ?? null,
          experienceLevel,
          discoveryEligible: isPlayerDiscoveryEligible(p),
        },
        update: {
          name: p.name,
          position: p.position || null,
          team: p.team || null,
          status: p.status,
          age: p.age ?? null,
          experienceLevel,
          discoveryEligible: isPlayerDiscoveryEligible(p),
        },
      })
    }
  }
}
