import type { RankingPreferences } from "@available-player-portal/shared"

/** Modal / profile form state (string inputs, same as discovery ranking modal). */
export type RankingDraft = {
  performance: string
  experience: string
  positionMatch: string
  availability: string
  recentTransactions: string
  targetPosition: string
}

export const EMPTY_RANKING_DRAFT: RankingDraft = {
  performance: "",
  experience: "",
  positionMatch: "",
  availability: "",
  recentTransactions: "",
  targetPosition: "",
}

export function isRankingDraftEmpty(draft: RankingDraft): boolean {
  return (
    !draft.performance.trim() &&
    !draft.experience.trim() &&
    !draft.positionMatch.trim() &&
    !draft.availability.trim() &&
    !draft.recentTransactions.trim() &&
    !draft.targetPosition.trim()
  )
}

export function isPitcherRankingTarget(targetPosition: string | undefined | null): boolean {
  return targetPosition?.trim() === "P"
}

export function rankingPreferencesToDraft(prefs?: RankingPreferences): RankingDraft {
  if (!prefs) return { ...EMPTY_RANKING_DRAFT }
  const tp = prefs.targetPosition ?? ""
  const pitcher = isPitcherRankingTarget(tp)
  return {
    performance: String(Math.round(prefs.weights.performance * 100)),
    experience: String(Math.round(prefs.weights.experience * 100)),
    positionMatch: pitcher ? "" : String(Math.round(prefs.weights.positionMatch * 100)),
    availability: String(Math.round(prefs.weights.availability * 100)),
    recentTransactions: String(Math.round(prefs.weights.recentTransactions * 100)),
    targetPosition: tp,
  }
}

export function rankingDraftToPreferences(draft: RankingDraft): RankingPreferences | null {
  const pitcher = isPitcherRankingTarget(draft.targetPosition)
  const perf = Number(draft.performance)
  const exp = Number(draft.experience)
  const pos = pitcher ? 0 : Number(draft.positionMatch)
  const avail = Number(draft.availability)
  const tx = Number(draft.recentTransactions)
  const nums = pitcher ? [perf, exp, avail, tx] : [perf, exp, pos, avail, tx]
  if (nums.some((n) => !Number.isFinite(n) || n < 0 || n > 100)) return null
  const total = pitcher ? perf + exp + avail + tx : perf + exp + pos + avail + tx
  if (Math.abs(total - 100) >= 0.00001) return null
  if (!draft.targetPosition.trim()) return null
  return {
    weights: {
      performance: perf / 100,
      experience: exp / 100,
      positionMatch: pos / 100,
      availability: avail / 100,
      recentTransactions: tx / 100,
    },
    targetPosition: draft.targetPosition.trim(),
  }
}

/** For UI: weight inputs must sum to 100; position match excluded from sum when target is pitcher (`P`). */
export function rankingDraftWeightValidation(draft: RankingDraft): {
  pitcherTarget: boolean
  total: number
  weightsValid: boolean
  targetSelected: boolean
} {
  const pitcherTarget = isPitcherRankingTarget(draft.targetPosition)
  const nums = pitcherTarget
    ? [
        Number(draft.performance),
        Number(draft.experience),
        Number(draft.availability),
        Number(draft.recentTransactions),
      ]
    : [
        Number(draft.performance),
        Number(draft.experience),
        Number(draft.positionMatch),
        Number(draft.availability),
        Number(draft.recentTransactions),
      ]
  const weightsValid =
    nums.every((n) => Number.isFinite(n) && n >= 0 && n <= 100) &&
    Math.abs(nums.reduce((a, b) => a + b, 0) - 100) < 0.00001
  return {
    pitcherTarget,
    total: nums.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0),
    weightsValid,
    targetSelected: Boolean(draft.targetPosition.trim()),
  }
}
