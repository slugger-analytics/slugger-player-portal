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
import { SYNC_UPSERT_CHUNK } from "../lib/syncBatch"
import { isPlayerDiscoveryEligible } from "../utils/playerEligibility"

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

  /** Eligible rows only (`discovery_eligible` maintained on upsert + migration backfill). */
  private withDiscoveryEligible(where: Prisma.PlayerWhereInput): Prisma.PlayerWhereInput {
    return { AND: [where, { discoveryEligible: true }] }
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

  /** Count rows matching filters and discovery eligibility (indexed). */
  async countPlayers(filters: PlayerFilters): Promise<number> {
    const where = this.withDiscoveryEligible(this.playerWhereFromFilters(filters))
    return prisma.player.count({ where })
  }

  /**
   * Discovery list: filters + `discovery_eligible` (same rules as {@link isPlayerDiscoveryEligible}).
   * Paginated requests use DB `skip`/`take` on `name` order.
   */
  async getPlayers(filters: PlayerFilters): Promise<Player[]> {
    const where = this.withDiscoveryEligible(this.playerWhereFromFilters(filters))
    const orderBy = { name: "asc" as const }
    if (filters.limit == null) {
      const rows = await prisma.player.findMany({ where, orderBy })
      return rows.map((r) => this.mapRow(r))
    }
    return prisma.player
      .findMany({
        where,
        orderBy,
        skip: filters.offset ?? 0,
        take: filters.limit,
      })
      .then((rows) => rows.map((r) => this.mapRow(r)))
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

  /** Idempotent sync: bulk upsert (one statement per chunk) for refresh/sync speed. */
  async upsertPlayers(players: Player[]): Promise<void> {
    if (players.length === 0) return
    const byId = new Map<string, Player>()
    for (const p of players) byId.set(p.id, p)
    const uniquePlayers = [...byId.values()]
    for (let i = 0; i < uniquePlayers.length; i += SYNC_UPSERT_CHUNK) {
      const chunk = uniquePlayers.slice(i, i + SYNC_UPSERT_CHUNK)
      const rows = chunk.map((p) => {
        const discoveryEligible = isPlayerDiscoveryEligible(p)
        return Prisma.sql`(${p.id}, ${p.name}, ${p.position || null}, ${p.team || null}, ${p.status}, ${p.age ?? null}, ${discoveryEligible}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      })
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "Player" ("id","name","position","team","status","age","discovery_eligible","created_at","updated_at")
        VALUES ${Prisma.join(rows)}
        ON CONFLICT ("id") DO UPDATE SET
          "name" = EXCLUDED."name",
          "position" = EXCLUDED."position",
          "team" = EXCLUDED."team",
          "status" = EXCLUDED."status",
          "age" = EXCLUDED."age",
          "discovery_eligible" = EXCLUDED."discovery_eligible",
          "updated_at" = CURRENT_TIMESTAMP
      `)
    }
  }
}
