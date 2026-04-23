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
  experienceLevelsAtOrAbove,
  experienceLevelsAtOrBelow,
  isExperienceLevelCode,
  isLastTransactionDaysOption,
} from "@available-player-portal/shared"
import type { BatHand as PrismaBatHand, ExperienceLevel, ThrowHand as PrismaThrowHand } from "@prisma/client"
import { Prisma } from "@prisma/client"
import type { Player, PlayerFilters } from "../types/models"
import { prisma } from "../lib/prisma"
import { isPlayerDiscoveryEligible } from "../utils/playerEligibility"

const DISCOVERY_SCAN_BATCH = 400
/** Stop scanning after this many DB rows to avoid unbounded reads (raise if your roster is larger). */
const DISCOVERY_SCAN_MAX_ROWS = 200_000

export class PlayerRepository {
  /** Flat `AND` clauses — avoids Prisma mis-combining `OR`/`NOT` (position) with `experienceLevel`. */
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
        clauses.push({ id: { equals: "__no_match__" } })
      }
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

  /** Shared `where` for `findMany` / `count` (does not use `limit` / `offset`). */
  private playerWhereFromFilters(filters: PlayerFilters): Prisma.PlayerWhereInput {
    const clauses = this.collectDiscoveryWhereClauses(filters)
    clauses.push({ hasProfileVisibleTransaction: true })
    return this.combineWhereClauses(clauses)
  }

  /** Same as API: indexed `discovery_eligible` + filters (used for transaction-recency path + count). */
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

  /**
   * Scans DB rows in `name` order and counts those passing {@link isPlayerDiscoveryEligible}.
   * Omits junk ids (e.g. `000`) and non-name rows from mis-parsed TBC CSV.
   */
  async countPlayers(filters: PlayerFilters): Promise<number> {
    if (filters.lastTransactionDays != null) {
      return prisma.player.count({ where: this.withDiscoveryEligible(filters) })
    }
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

  /** Id + name for every row matching filters + `discovery_eligible` (aligned with API list semantics). */
  async listPlayerIdAndNameMatching(filters: PlayerFilters): Promise<{ id: string; name: string }[]> {
    const where = {
      AND: [this.playerWhereFromFilters(filters), { discoveryEligible: true }],
    }
    return prisma.player.findMany({
      where,
      select: { id: true, name: true },
    })
  }

  async getPlayersByIdsInOrder(ids: string[]): Promise<Player[]> {
    if (ids.length === 0) return []
    const rows = await prisma.player.findMany({ where: { id: { in: ids } } })
    const byId = new Map(rows.map((r) => [r.id, this.mapRow(r)]))
    return ids.map((id) => byId.get(id)).filter((r): r is Player => r != null)
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

  /** Idempotent sync: same `id` updates name/team/status/age/experience without duplicating rows. */
  async upsertPlayers(players: Player[]): Promise<void> {
    for (const p of players) {
      const experienceLevel =
        p.experienceLevel != null && p.experienceLevel !== ""
          ? (p.experienceLevel as ExperienceLevel)
          : null
      const bats = p.bats != null ? (p.bats as PrismaBatHand) : null
      const throws = p.throws != null ? (p.throws as PrismaThrowHand) : null
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
          bats,
          throws,
          discoveryEligible: isPlayerDiscoveryEligible(p),
        },
        update: {
          name: p.name,
          position: p.position || null,
          team: p.team || null,
          status: p.status,
          age: p.age ?? null,
          experienceLevel,
          bats,
          throws,
          discoveryEligible: isPlayerDiscoveryEligible(p),
        },
      })
    }
  }
}
