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

export class PlayerRepository {
  /** Shared `where` for `findMany` / `count` (does not use `limit` / `offset`). */
  private playerWhereFromFilters(filters: PlayerFilters): Prisma.PlayerWhereInput {
    const where: Prisma.PlayerWhereInput = {}
    if (filters.position) {
      const fp = filters.position.toLowerCase()
      if (fp.includes("pitch")) {
        where.OR = [
          { position: { contains: "Pitch", mode: "insensitive" } },
          { position: { equals: "p", mode: "insensitive" } },
          { position: { startsWith: "p-", mode: "insensitive" } },
        ]
      } else {
        where.position = { contains: filters.position, mode: "insensitive" }
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
    return where
  }

  /** Row count for the same filter semantics as {@link getPlayers} (ignores pagination). */
  async countPlayers(filters: PlayerFilters): Promise<number> {
    const where = this.playerWhereFromFilters(filters)
    return prisma.player.count({ where })
  }

  /** Applies optional `position`, `status`, `team`, `ageMin`/`ageMax` query semantics. */
  async getPlayers(filters: PlayerFilters): Promise<Player[]> {
    const where = this.playerWhereFromFilters(filters)
    const args: Prisma.PlayerFindManyArgs = {
      where,
      orderBy: { name: "asc" },
    }
    if (filters.limit != null) {
      args.take = filters.limit
      args.skip = filters.offset ?? 0
    }
    const rows = await prisma.player.findMany(args)
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      position: r.position ?? "",
      team: r.team ?? "",
      status: r.status,
      age: r.age ?? undefined,
    }))
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
