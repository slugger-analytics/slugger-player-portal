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

import { isExperienceLevelCode, isLastTransactionDaysOption } from "@available-player-portal/shared"
import type { BatHand as PrismaBatHand, ExperienceLevel, ThrowHand as PrismaThrowHand } from "@prisma/client"
import { Prisma } from "@prisma/client"
import type { Player, PlayerFilters } from "../types/models"
import { prisma } from "../lib/prisma"
import { SYNC_UPSERT_CHUNK } from "../lib/syncBatch"
import { isPlayerDiscoveryEligible } from "../utils/playerEligibility"

export class PlayerRepository {
  /**
   * Builds flat `AND` clauses so `OR`/`NOT` (position) never nest inside a sibling object
   * with `experienceLevel` — Prisma can generate wrong SQL for that shape.
   */
  private collectDiscoveryWhereClauses(
    filters: PlayerFilters,
    opts?: { omitLastTransactionRecency?: boolean },
  ): Prisma.PlayerWhereInput[] {
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
    if (opts?.omitLastTransactionRecency !== true && filters.lastTransactionDays != null) {
      if (!isLastTransactionDaysOption(filters.lastTransactionDays)) {
        throw new Error(`Invalid lastTransactionDays: ${filters.lastTransactionDays}`)
      }
      const cutoff = new Date()
      cutoff.setTime(cutoff.getTime() - filters.lastTransactionDays * 24 * 60 * 60 * 1000)
      clauses.push({
        transactions: { some: { date: { gte: cutoff } } },
      })
    }
    if (filters.bats != null) {
      clauses.push({ bats: filters.bats as PrismaBatHand })
    }
    if (filters.throws != null) {
      clauses.push({ throws: filters.throws as PrismaThrowHand })
    }
    return clauses
  }

  private combineWhereClauses(clauses: Prisma.PlayerWhereInput[]): Prisma.PlayerWhereInput {
    if (clauses.length === 0) return {}
    if (clauses.length === 1) return clauses[0]!
    return { AND: clauses }
  }

  /** Eligible rows only (`discovery_eligible` maintained on upsert + migration backfill). */
  private withDiscoveryEligible(
    filters: PlayerFilters,
    opts?: { omitLastTransactionRecency?: boolean },
  ): Prisma.PlayerWhereInput {
    const clauses = this.collectDiscoveryWhereClauses(filters, opts)
    clauses.push({ hasProfileVisibleTransaction: true })
    clauses.push({ discoveryEligible: true })
    return this.combineWhereClauses(clauses)
  }

  private transactionRecencyCutoff(filters: PlayerFilters): Date {
    const n = filters.lastTransactionDays!
    if (!isLastTransactionDaysOption(n)) {
      throw new Error(`Invalid lastTransactionDays: ${n}`)
    }
    const cutoff = new Date()
    cutoff.setTime(cutoff.getTime() - n * 24 * 60 * 60 * 1000)
    return cutoff
  }

  /**
   * `findMany` cannot order by max(transaction.date); use grouped transactions then hydrate players.
   */
  private async getPlayersByRecentTransaction(filters: PlayerFilters): Promise<Player[]> {
    const cutoff = this.transactionRecencyCutoff(filters)
    const playerWhere = this.withDiscoveryEligible(filters, { omitLastTransactionRecency: true })
    const groups = await prisma.transaction.groupBy({
      by: ["playerId"],
      where: {
        date: { gte: cutoff },
        player: { is: playerWhere },
      },
      _max: { date: true },
      /** Tie-break so skip/take pagination is stable when many players share the same max date. */
      orderBy: [{ _max: { date: "desc" } }, { playerId: "asc" }],
      ...(filters.limit != null
        ? { skip: filters.offset ?? 0, take: filters.limit }
        : {}),
    })
    const ids = groups.map((g) => g.playerId)
    if (ids.length === 0) return []
    const rows = await prisma.player.findMany({ where: { id: { in: ids } } })
    const byId = new Map(rows.map((r) => [r.id, r]))
    return ids.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => r != null).map((r) => this.mapRow(r))
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
    bats: PrismaBatHand | null
    throws: PrismaThrowHand | null
  }): Player {
    return {
      id: r.id,
      name: r.name,
      position: r.position ?? "",
      team: r.team ?? "",
      status: r.status,
      age: r.age ?? undefined,
      experienceLevel: r.experienceLevel ?? undefined,
      bats: r.bats ?? undefined,
      throws: r.throws ?? undefined,
    }
  }

  /** Count rows matching filters and discovery eligibility (indexed). */
  async countPlayers(filters: PlayerFilters): Promise<number> {
    const where = this.withDiscoveryEligible(filters)
    return prisma.player.count({ where })
  }

  /** Id + name for every row matching filters (no pagination). Used to sort by profile-visible tx in {@link PlayerDataService}. */
  async listPlayerIdAndNameMatching(filters: PlayerFilters): Promise<{ id: string; name: string }[]> {
    const where = this.withDiscoveryEligible(filters)
    return prisma.player.findMany({
      where,
      select: { id: true, name: true },
    })
  }

  /** Hydrate full {@link Player} rows in the given id order. */
  async getPlayersByIdsInOrder(ids: string[]): Promise<Player[]> {
    if (ids.length === 0) return []
    const rows = await prisma.player.findMany({ where: { id: { in: ids } } })
    const byId = new Map(rows.map((r) => [r.id, this.mapRow(r)]))
    return ids.map((id) => byId.get(id)).filter((r): r is Player => r != null)
  }

  /**
   * Discovery list: filters + `discovery_eligible` (same rules as {@link isPlayerDiscoveryEligible}).
   * Paginated requests use DB `skip`/`take` on `name` order.
   */
  async getPlayers(filters: PlayerFilters): Promise<Player[]> {
    if (filters.lastTransactionDays != null) {
      return this.getPlayersByRecentTransaction(filters)
    }
    if (filters.sortBy === "recentProfileTransaction" || filters.sortBy === "lastName") {
      throw new Error(
        "sortBy=recentProfileTransaction|lastName is handled in PlayerDataService (custom ordering)",
      )
    }
    const where = this.withDiscoveryEligible(filters)
    const orderBy = this.orderByFromFilters(filters)
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

  /** Lookup by primary key; only players with at least one profile-visible transaction (portal-visible). */
  async getPlayerById(id: string): Promise<Player | null> {
    const r = await prisma.player.findFirst({
      where: { id, hasProfileVisibleTransaction: true },
    })
    if (!r) return null
    return {
      id: r.id,
      name: r.name,
      position: r.position ?? "",
      team: r.team ?? "",
      status: r.status,
      age: r.age ?? undefined,
      experienceLevel: r.experienceLevel ?? undefined,
      bats: r.bats ?? undefined,
      throws: r.throws ?? undefined,
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
        const elSql =
          p.experienceLevel != null && p.experienceLevel !== ""
            ? Prisma.sql`CAST(${p.experienceLevel} AS "ExperienceLevel")`
            : Prisma.sql`NULL`
        const batsSql =
          p.bats != null ? Prisma.sql`CAST(${p.bats} AS "BatHand")` : Prisma.sql`NULL`
        const throwsSql =
          p.throws != null ? Prisma.sql`CAST(${p.throws} AS "ThrowHand")` : Prisma.sql`NULL`
        return Prisma.sql`(${p.id}, ${p.name}, ${p.position || null}, ${p.team || null}, ${p.status}, ${p.age ?? null}, ${elSql}, ${batsSql}, ${throwsSql}, ${discoveryEligible}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      })
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "Player" ("id","name","position","team","status","age","experience_level","bats","throws","discovery_eligible","created_at","updated_at")
        VALUES ${Prisma.join(rows)}
        ON CONFLICT ("id") DO UPDATE SET
          "name" = EXCLUDED."name",
          "position" = EXCLUDED."position",
          "team" = EXCLUDED."team",
          "status" = EXCLUDED."status",
          "age" = EXCLUDED."age",
          "experience_level" = EXCLUDED."experience_level",
          "bats" = EXCLUDED."bats",
          "throws" = EXCLUDED."throws",
          "discovery_eligible" = EXCLUDED."discovery_eligible",
          "updated_at" = CURRENT_TIMESTAMP
      `)
    }
  }
}
