/**
 * @file StatLineService.ts
 * @description Pure helpers for **display strings** and **season selection** from stat arrays.
 *
 * **Purpose:** Keep API responses consistent when summarizing cards (`PlayerSummary`)
 * and when filling `PlayerProfile` “most recent” / “previous” season slots.
 *
 * **Usage:** Used by `PlayerDataService` only. Batting lines use AVG/OBP/SLG/HR; pitching
 * uses ERA/WHIP/K/IP from the most recent season row after sorting by `season` desc.
 */

import type { BattingStats, PitchingStats } from "../types/models"

function formatPitchingIp(ip: number): string {
  if (!Number.isFinite(ip)) return "—"
  return ip.toFixed(1).replace(/\.0$/, "")
}

export class StatLineService {
  /**
   * Compact line for list cards, e.g. `AVG: 0.300 | OBP: 0.350 | …` or `ERA: 3.50 | WHIP: …`.
   * Uses the **latest** season row (by `season` descending).
   */
  generateMinimalStatLine(stats: BattingStats[] | PitchingStats[]): string {
    if (!stats.length) return "—"
    const sorted = [...stats].sort((a, b) => b.season - a.season)
    const first = sorted[0]
    if ("ops" in first && "avg" in first) {
      const b = first as BattingStats
      return `AVG: ${b.avg.toFixed(3)} | OBP: ${b.obp.toFixed(3)} | SLG: ${b.slg.toFixed(3)} | HR: ${b.hr}`
    }
    const p = first as PitchingStats
    return `ERA: ${p.era.toFixed(2)} | WHIP: ${p.whip.toFixed(2)} | K: ${p.k} | IP: ${formatPitchingIp(p.ip)}`
  }

  /** Highest `season` value in the array, or null if empty. */
  selectMostRecentSeason(
    stats: BattingStats[] | PitchingStats[],
  ): BattingStats | PitchingStats | null {
    return this.selectMostRecentSeasonRows(stats)[0] ?? null
  }

  /** Second-highest `season` (e.g. prior year), or null if fewer than two seasons. */
  selectPreviousSeason(
    stats: BattingStats[] | PitchingStats[],
  ): BattingStats | PitchingStats | null {
    if (stats.length < 2) return null
    const sorted = [...stats].sort((a, b) => b.season - a.season)
    const mostRecentSeason = sorted[0]?.season
    const previous = sorted.find((s) => s.season < (mostRecentSeason ?? Number.POSITIVE_INFINITY))
    return previous ?? null
  }

  /** All rows for the latest season (for multi-team same-year entries). */
  selectMostRecentSeasonRows(
    stats: BattingStats[] | PitchingStats[],
  ): Array<BattingStats | PitchingStats> {
    if (!stats.length) return []
    const sorted = [...stats].sort((a, b) => b.season - a.season)
    const mostRecentSeason = sorted[0]!.season
    return sorted.filter((s) => s.season === mostRecentSeason)
  }
}

/**
 * Chooses which stat array drives {@link StatLineService.generateMinimalStatLine} for a
 * player card: pitchers (or pitching-only) → pitching stats; otherwise batting if present.
 */
export function pickStatArrayForLine(
  batting: BattingStats[],
  pitching: PitchingStats[],
  position: string,
): BattingStats[] | PitchingStats[] {
  const pos = position.toLowerCase()
  if (pitching.length && (pos.includes("pitch") || pos === "p" || (!batting.length && pitching.length))) {
    return pitching
  }
  if (batting.length) return batting
  return pitching
}
