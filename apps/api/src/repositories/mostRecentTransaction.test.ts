import assert from "node:assert/strict"
import test from "node:test"
import { isTransactionShownOnPlayerProfile } from "@available-player-portal/shared"
import { pickMostRecentByPlayer, type ProfileTxRow } from "./mostRecentTransaction"

const row = (id: number, playerId: string, date: string, type: string): ProfileTxRow => ({
  id,
  playerId,
  date: new Date(`${date}T00:00:00.000Z`),
  type,
})

/** Player 1001 has two profile-visible rows on the SAME date (ids 8 and 9) — the ambiguous case. */
const FIXTURE: ProfileTxRow[] = [
  row(1, "1001", "2026-06-01", "Free Agent"),
  row(8, "1001", "2026-07-20", "Free Agent"),
  row(9, "1001", "2026-07-20", "Released"),
  row(3, "2002", "2026-05-11", "Released"),
  row(4, "2002", "2026-07-02", "Retired"),
  row(5, "3003", "2026-07-30", "Signed"),
  row(6, "3003", "2026-06-15", "Released"),
  row(7, "4004", "2026-07-25", "Free Agent"),
]

const always = () => true

test("the winner is independent of the row order the database happens to return", () => {
  const permutations: ProfileTxRow[][] = [
    [...FIXTURE].reverse(),
    [...FIXTURE].sort((a, b) => a.id - b.id),
    [...FIXTURE].sort((a, b) => b.id - a.id),
    [...FIXTURE].sort((a, b) => a.date.getTime() - b.date.getTime()),
    [...FIXTURE].sort((a, b) => b.date.getTime() - a.date.getTime()),
    [FIXTURE[2]!, FIXTURE[5]!, FIXTURE[0]!, FIXTURE[7]!, FIXTURE[1]!, FIXTURE[4]!, FIXTURE[3]!, FIXTURE[6]!],
  ]
  const results = permutations.map((rows) => pickMostRecentByPlayer(rows, isTransactionShownOnPlayerProfile))
  for (const r of results) {
    assert.deepStrictEqual([...r].sort(), [...results[0]!].sort())
  }
  assert.equal(results[0]!.get("1001")?.type, "Released", "id 9 wins the same-date tie (date desc, id desc)")
})

test("the type filter is applied before a winner is chosen", () => {
  // 3003's newest row (Signed) is not profile-visible; the older Released row must still win.
  const picked = pickMostRecentByPlayer(FIXTURE, isTransactionShownOnPlayerProfile)
  assert.deepStrictEqual(picked.get("3003"), { date: "2026-06-15", type: "Released" })
})

test("the discovery card and the profile page cannot disagree", () => {
  const card = pickMostRecentByPlayer(FIXTURE, isTransactionShownOnPlayerProfile)
  // Profile page ordering: [{ date: "desc" }, { id: "desc" }], first profile-visible row per player.
  const profileOrder = [...FIXTURE]
    .filter((r) => isTransactionShownOnPlayerProfile(r.type))
    .sort((a, b) => b.date.getTime() - a.date.getTime() || b.id - a.id)
  for (const [playerId, answer] of card) {
    const top = profileOrder.find((r) => r.playerId === playerId)!
    assert.deepStrictEqual(answer, { date: top.date.toISOString().slice(0, 10), type: top.type })
  }
})

test("asOfDate caps the card to the anchored window (inclusive) without touching unanchored calls", () => {
  const rows = [row(1, "9001", "2026-08-01", "Released"), row(2, "9001", "2026-07-15", "Free Agent")]
  assert.deepStrictEqual(pickMostRecentByPlayer(rows, always, "2026-07-26"), new Map([
    ["9001", { date: "2026-07-15", type: "Free Agent" }],
  ]))
  assert.deepStrictEqual(pickMostRecentByPlayer(rows, always), new Map([
    ["9001", { date: "2026-08-01", type: "Released" }],
  ]))
  const onAnchor = [row(3, "9002", "2026-07-26", "Released")]
  assert.deepStrictEqual(pickMostRecentByPlayer(onAnchor, always, "2026-07-26").get("9002"), {
    date: "2026-07-26",
    type: "Released",
  })
  const afterAnchor = [row(4, "9003", "2026-07-27", "Released")]
  assert.equal(pickMostRecentByPlayer(afterAnchor, always, "2026-07-26").has("9003"), false)
})
