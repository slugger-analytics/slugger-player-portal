/** Bats: left, right, or both (switch). */
export type BatHand = "L" | "R" | "B"

/** Throws: left or right only. */
export type ThrowHand = "L" | "R"

export function parseBatHandFromFeedCell(cell: string): BatHand | undefined {
  const u = cell.trim().toUpperCase()
  if (u === "L" || u === "LHB" || u === "LEFT") return "L"
  if (u === "R" || u === "RHB" || u === "RIGHT") return "R"
  if (u === "B" || u === "S" || u === "SW" || u === "SWITCH" || u === "BOTH") return "B"
  return undefined
}

export function parseThrowHandFromFeedCell(cell: string): ThrowHand | undefined {
  const u = cell.trim().toUpperCase()
  if (u === "L" || u === "LHP" || u === "LEFT") return "L"
  if (u === "R" || u === "RHP" || u === "RIGHT") return "R"
  return undefined
}

export function parseBatHandFromPlayerRow(raw: Record<string, unknown>): BatHand | undefined {
  const s = (k: string) => String(raw[k] ?? "").trim()
  const cell = s("bats") || s("Bats") || s("bat") || s("Bat") || ""
  return parseBatHandFromFeedCell(cell)
}

export function parseThrowHandFromPlayerRow(raw: Record<string, unknown>): ThrowHand | undefined {
  const s = (k: string) => String(raw[k] ?? "").trim()
  const cell = s("throws") || s("Throws") || s("throw") || s("Throw") || ""
  return parseThrowHandFromFeedCell(cell)
}

export function isBatHandQueryValue(s: string): s is BatHand {
  const u = s.trim().toUpperCase()
  return u === "L" || u === "R" || u === "B"
}

export function isThrowHandQueryValue(s: string): s is ThrowHand {
  const u = s.trim().toUpperCase()
  return u === "L" || u === "R"
}

/** Profile / detail UI: full word for batting side (L/R/B = both). */
export function batHandDisplayLabel(h: BatHand): string {
  if (h === "L") return "Left"
  if (h === "R") return "Right"
  return "Both"
}

/** Profile / detail UI: full word for throwing arm. */
export function throwHandDisplayLabel(h: ThrowHand): string {
  return h === "L" ? "Left" : "Right"
}
