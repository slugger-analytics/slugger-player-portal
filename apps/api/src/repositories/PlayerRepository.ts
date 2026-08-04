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

import {
  effectiveDiscoveryTransactionTypeFilters,
  experienceLevelsAtOrAbove,
  experienceLevelsAtOrBelow,
  isExperienceLevelCode,
  PROFILE_VISIBLE_TRANSACTION_TYPE_RULES,
  type TransactionTypeFilter,
} from "@available-player-portal/shared"
import type { BatHand as PrismaBatHand, ExperienceLevel, ThrowHand as PrismaThrowHand } from "@prisma/client"
import { Prisma } from "@prisma/client"
import type { Player, PlayerFilters } from "../types/models"
import { prisma } from "../lib/prisma"
import { SYNC_UPSERT_CHUNK } from "../lib/syncBatch"
import { isPlayerDiscoveryEligible } from "../utils/playerEligibility"
import { buildPositionWhereClauses } from "./positionFilter"
import { transactionWindow } from "./transactionWindow"

export class PlayerRepository {
  /**
   * Prisma filter for transaction rows counted toward “last X days” and recency ordering.
   * Must stay aligned with {@link TransactionRepository} profile-visible / type-filter logic.
   */
  private discoveryTransactionTypeWhere(types?: TransactionTypeFilter[]): Prisma.TransactionWhereInput {
    const cats = effectiveDiscoveryTransactionTypeFilters(types)
    const parts: Prisma.TransactionWhereInput[] = []
    for (const c of cats) {
      const rules = PROFILE_VISIBLE_TRANSACTION_TYPE_RULES[c]
      parts.push({
        OR: rules.map((r) =>
          r.kind === "exact"
            ? { type: { equals: r.value, mode: "insensitive" } }
            : { type: { startsWith: r.value, mode: "insensitive" } },
        ),
      })
    }
    if (parts.length === 0) return { playerId: { equals: "__portal_no_tx_type_match__" } }
    return parts.length === 1 ? parts[0]! : { OR: parts }
  }

  /**
   * Builds flat `AND` clauses so `OR`/`NOT` (position) never nest inside a sibling object
   * with `experienceLevel` — Prisma can generate wrong SQL for that shape.
   */
  private collectDiscoveryWhereClauses(
    filters: PlayerFilters,
    opts?: { omitLastTransactionRecency?: boolean },
  ): Prisma.PlayerWhereInput[] {
    const clauses: Prisma.PlayerWhereInput[] = []
    const nameQ = filters.nameSearch?.trim()
    if (nameQ) {
      clauses.push({ name: { contains: nameQ.slice(0, 200), mode: "insensitive" } })
    }
    if (filters.position) {
      clauses.push(...buildPositionWhereClauses(filters.position))
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
    const maxCode = filters.experienceLevel?.trim()
    const minCode = filters.experienceLevelMin?.trim()
    if (maxCode) {
      if (!isExperienceLevelCode(maxCode)) throw new Error(`Invalid experienceLevel: ${maxCode}`)
    }
    if (minCode) {
      if (!isExperienceLevelCode(minCode)) throw new Error(`Invalid experienceLevelMin: ${minCode}`)
    }
    if (maxCode || minCode) {
      const above = minCode ? new Set(experienceLevelsAtOrAbove(minCode)) : null
      const below = maxCode ? new Set(experienceLevelsAtOrBelow(maxCode)) : null
      const allowed = ((): ExperienceLevel[] => {
        const all = ["ROOKIE", "A", "A_PLUS", "AA", "AAA", "MLB"] as const
        const out: ExperienceLevel[] = []
        for (const c of all) {
          if (above && !above.has(c)) continue
          if (below && !below.has(c)) continue
          out.push(c as ExperienceLevel)
        }
        return out
      })()
      if (allowed.length) {
        clauses.push({ experienceLevel: { in: allowed } })
      } else {
        // Impossible range → return empty result set.
        clauses.push({ id: { equals: "__no_match__" } })
      }
    }
    if (filters.hasStats) {
      clauses.push({
        OR: [{ battingStats: { some: {} } }, { pitchingStats: { some: {} } }],
      })
    }
    if (opts?.omitLastTransactionRecency !== true && filters.lastTransactionDays != null) {
      const w = transactionWindow(filters)
      clauses.push({
        transactions: {
          some: {
            AND: [
              { date: { gte: w.gte, lte: w.lte } },
              this.discoveryTransactionTypeWhere(filters.transactionTypes),
            ],
          },
        },
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

  /**
   * `findMany` cannot order by max(transaction.date); use grouped transactions then hydrate players.
   * `_max` is taken over the **windowed** rows, so the list orders by newest matching transaction
   * inside the window rather than newest overall (which is TBC’s ordering under an anchor).
   */
  private async getPlayersByRecentTransaction(filters: PlayerFilters): Promise<Player[]> {
    const w = transactionWindow(filters)
    const playerWhere = this.withDiscoveryEligible(filters, { omitLastTransactionRecency: true })
    const typeWhere = this.discoveryTransactionTypeWhere(filters.transactionTypes)
    const groups = await prisma.transaction.groupBy({
      by: ["playerId"],
      where: {
        AND: [{ date: { gte: w.gte, lte: w.lte } }, typeWhere],
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
    if (
      filters.sortBy === "recentProfileTransaction" ||
      filters.sortBy === "lastName" ||
      filters.sortBy === "rankScore"
    ) {
      throw new Error(
        "sortBy=recentProfileTransaction|lastName|rankScore is handled in PlayerDataService (custom ordering)",
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
