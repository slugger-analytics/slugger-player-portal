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

import { Prisma } from "@prisma/client"
import type { Player, PlayerFilters } from "../types/models"
import { prisma } from "../lib/prisma"
import { isPlayerDiscoveryEligible } from "../utils/playerEligibility"

const DISCOVERY_SCAN_BATCH = 400
/** Stop scanning after this many DB rows to avoid unbounded reads (raise if your roster is larger). */
const DISCOVERY_SCAN_MAX_ROWS = 200_000

export class PlayerRepository {
  /** Shared `where` for `findMany` / `count` (does not use `limit` / `offset`). */
  private playerWhereFromFilters(filters: PlayerFilters): Prisma.PlayerWhereInput {
    const where: Prisma.PlayerWhereInput = {}
    if (filters.position) {
      const raw = filters.position.trim()
      const fp = raw.toLowerCase()
      const pitcherMatch: Prisma.PlayerWhereInput[] = [
        { position: { contains: "Pitch", mode: "insensitive" } },
        { position: { equals: "p", mode: "insensitive" } },
        { position: { startsWith: "p-", mode: "insensitive" } },
      ]
      if (fp === "non-p") {
        where.NOT = { OR: pitcherMatch }
      } else if (fp === "p" || fp.includes("pitch")) {
        where.OR = pitcherMatch
      } else {
        where.position = { contains: raw, mode: "insensitive" }
      }
    }
    if (filters.status) {
      where.status = filters.status as string
    }
    if (filters.team) {
      where.team = { contains: filters.team, mode: "insensitive" }
    }
    if (filters.ageMin != null || filters.ageMax != null) {
      where.age = {}
      if (filters.ageMin != null) where.age.gte = filters.ageMin
      if (filters.ageMax != null) where.age.lte = filters.ageMax
    }
    if (filters.hasStats) {
      return {
        AND: [
          where,
          {
            OR: [{ battingStats: { some: {} } }, { pitchingStats: { some: {} } }],
          },
        ],
      }
    }
    return where
  }

  private mapRow(r: {
    id: string
    name: string
    position: string | null
    team: string | null
    status: string
    age: number | null
  }): Player {
    return {
      id: r.id,
      name: r.name,
      position: r.position ?? "",
      team: r.team ?? "",
      status: r.status,
      age: r.age ?? undefined,
    }
  }

  /**
   * Scans DB rows in `name` order and counts those passing {@link isPlayerDiscoveryEligible}.
   * Omits junk ids (e.g. `000`) and non-name rows from mis-parsed TBC CSV.
   */
  async countPlayers(filters: PlayerFilters): Promise<number> {
    const where = this.playerWhereFromFilters(filters)
    let dbSkip = 0
    let eligible = 0
    while (dbSkip < DISCOVERY_SCAN_MAX_ROWS) {
      const batch = await prisma.player.findMany({
        where,
        orderBy: { name: "asc" },
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
    if (filters.limit == null) {
      const rows = await prisma.player.findMany({ where, orderBy: { name: "asc" } })
      return rows.map((r) => this.mapRow(r)).filter(isPlayerDiscoveryEligible)
    }
    const needEnd = (filters.offset ?? 0) + filters.limit
    let dbSkip = 0
    const eligible: Player[] = []
    while (eligible.length < needEnd && dbSkip < DISCOVERY_SCAN_MAX_ROWS) {
      const batch = await prisma.player.findMany({
        where,
        orderBy: { name: "asc" },
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
    }
  }

  /** Idempotent sync: same `id` updates name/team/status/age without duplicating rows. */
  async upsertPlayers(players: Player[]): Promise<void> {
    for (const p of players) {
      await prisma.player.upsert({
        where: { id: p.id },
        create: {
          id: p.id,
          name: p.name,
          position: p.position || null,
          team: p.team || null,
          status: p.status,
          age: p.age ?? null,
        },
        update: {
          name: p.name,
          position: p.position || null,
          team: p.team || null,
          status: p.status,
          age: p.age ?? null,
        },
      })
    }
  }
}
