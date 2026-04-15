import type { RankingWeights } from "./models"

export type RankPlayerContext = {
  id: string
  position: string
  status: string
  experienceLevel?: string | null
  isPitcher: boolean
  // Hitters
  ops?: number
  obp?: number
  slg?: number
  // Pitchers
  era?: number
  whip?: number
  k?: number
  ip?: number
  // Most recent profile-visible transaction.
  transactionDate?: string | null
  transactionType?: string | null
}

export type RankInput = {
  players: RankPlayerContext[]
  weights: RankingWeights
  targetPosition?: string
  now?: Date
}

export type RankScoreResult = {
  score: number
  components: {
    performance: number
    experience: number
    positionMatch: number
    availability: number
    recentTransactions: number
    lambda: number
  }
}

const EXP_LEVEL_SCORE: Record<string, number> = {
  MLB: 1,
  AAA: 0.75,
  AA: 0.5,
  A_PLUS: 0.35,
  A: 0.25,
  ROOKIE: 0.1,
}

const RECENCY_ANCHORS: Array<{ days: number; value: number }> = [
  { days: 14, value: 0.8 },
  { days: 21, value: 0.5 },
  { days: 28, value: 0.3 },
  { days: 35, value: 0.1 },
]

function normalize(values: number[]): number[] {
  if (!values.length) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max <= min) return values.map(() => 0.5)
  return values.map((v) => (v - min) / (max - min))
}

function normalizePitchingEra(era: number, minEra: number, maxEra: number): number {
  if (maxEra <= minEra) return 0.5
  const normalized = (era - minEra) / (maxEra - minEra)
  return 1 - normalized
}

function deriveLambdaFromAnchors(): number {
  // Least squares fit of ln(weight)= -lambda*days through origin.
  let sumX2 = 0
  let sumXY = 0
  for (const a of RECENCY_ANCHORS) {
    if (a.value <= 0 || a.value >= 1) continue
    const x = a.days
    const y = -Math.log(a.value)
    sumX2 += x * x
    sumXY += x * y
  }
  if (sumX2 <= 0) return 0
  return sumXY / sumX2
}

function normalizePosition(value: string): string {
  const v = value.trim().toLowerCase()
  if (!v) return ""
  if (v === "p" || v.startsWith("p-") || v.includes("pitch")) return "pitcher"
  return v
}

function recencyWeight(daysAgo: number, lambda: number): number {
  if (daysAgo <= 7) return 1
  if (daysAgo > 35) return 0
  if (daysAgo > 28) return 0.1
  const expWeight = Math.exp(-lambda * daysAgo)
  if (daysAgo <= 14) return Math.max(0.8, Math.min(1, expWeight))
  if (daysAgo <= 21) return Math.max(0.5, Math.min(0.8, expWeight))
  return Math.max(0.3, Math.min(0.5, expWeight))
}

function availabilityScore(status: string, transactionType?: string | null): number {
  const tx = (transactionType ?? "").trim().toLowerCase()
  if (tx === "free agent" || tx.startsWith("free agency")) return 1
  if (tx === "retired" || tx === "released") return 0.5
  const s = status.trim().toLowerCase()
  if (s === "signed") return 0
  return 0.5
}

function transactionEventValue(transactionType?: string | null): number {
  const tx = (transactionType ?? "").trim().toLowerCase()
  if (tx === "free agent" || tx.startsWith("free agency")) return 1
  if (tx === "released") return 0.5
  if (tx === "retired") return 0.3
  return 0.1
}

function parseDaysAgo(date: string | null | undefined, now: Date): number | null {
  if (!date) return null
  const dt = new Date(`${date}T12:00:00.000Z`)
  if (Number.isNaN(dt.getTime())) return null
  return Math.max(0, Math.floor((now.getTime() - dt.getTime()) / (1000 * 60 * 60 * 24)))
}

export function computeRankScores(input: RankInput): Map<string, RankScoreResult> {
  const now = input.now ?? new Date()
  const lambda = deriveLambdaFromAnchors()
  const weights = input.weights

  const hitterPerfRaw: number[] = []
  const pitcherEra: number[] = []
  const pitcherWhipRaw: number[] = []
  const pitcherK9Raw: number[] = []
  for (const p of input.players) {
    if (p.isPitcher) {
      pitcherEra.push(p.era ?? 0)
      pitcherWhipRaw.push((p.whip ?? 0) * -1)
      const k9 = p.ip && p.ip > 0 ? ((p.k ?? 0) * 9) / p.ip : 0
      pitcherK9Raw.push(k9)
    } else {
      hitterPerfRaw.push((p.ops ?? 0) * 0.5 + (p.obp ?? 0) * 0.3 + (p.slg ?? 0) * 0.2)
    }
  }

  const normalizedHitter = normalize(hitterPerfRaw)
  const normalizedPitcherWhip = normalize(pitcherWhipRaw)
  const normalizedPitcherK9 = normalize(pitcherK9Raw)
  const minEra = pitcherEra.length ? Math.min(...pitcherEra) : 0
  const maxEra = pitcherEra.length ? Math.max(...pitcherEra) : 0

  let hitterIndex = 0
  let pitcherIndex = 0
  const out = new Map<string, RankScoreResult>()
  const targetPos = normalizePosition(input.targetPosition ?? "")

  for (const p of input.players) {
    let performance = 0
    if (p.isPitcher) {
      const era = p.era ?? 0
      const eraScore = normalizePitchingEra(era, minEra, maxEra)
      const whipScore = normalizedPitcherWhip[pitcherIndex] ?? 0
      const k9Score = normalizedPitcherK9[pitcherIndex] ?? 0
      performance = eraScore * 0.4 + whipScore * 0.3 + k9Score * 0.3
      pitcherIndex++
    } else {
      performance = normalizedHitter[hitterIndex] ?? 0
      hitterIndex++
    }

    const experience = EXP_LEVEL_SCORE[(p.experienceLevel ?? "").toUpperCase()] ?? 0.1
    const positionMatch = targetPos ? (normalizePosition(p.position) === targetPos ? 1 : 0) : 1
    const availability = availabilityScore(p.status, p.transactionType)
    const daysAgo = parseDaysAgo(p.transactionDate, now)
    const txRecency = daysAgo == null ? 0 : recencyWeight(daysAgo, lambda) * transactionEventValue(p.transactionType)

    const score =
      weights.performance * performance +
      weights.experience * experience +
      weights.positionMatch * positionMatch +
      weights.availability * availability +
      weights.recentTransactions * txRecency

    out.set(p.id, {
      score,
      components: {
        performance,
        experience,
        positionMatch,
        availability,
        recentTransactions: txRecency,
        lambda,
      },
    })
  }
  return out
}
