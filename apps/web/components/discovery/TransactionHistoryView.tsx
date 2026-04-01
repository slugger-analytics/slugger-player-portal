"use client"

/**
 * @file TransactionHistoryView.tsx
 * @description Client timeline — loads `GET /players/:id/transactions` (DB-backed, chronological).
 */

import { useEffect, useState } from "react"
import type { Transaction } from "@available-player-portal/shared"
import { fetchPlayerTransactions } from "@/lib/api"

type Props = {
  playerId: string
}

export function TransactionHistoryView({ playerId }: Props) {
  const [items, setItems] = useState<Transaction[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setItems(null)
    setError(null)
    fetchPlayerTransactions(playerId)
      .then((rows) => {
        if (!cancelled) setItems(rows)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load")
      })
    return () => {
      cancelled = true
    }
  }, [playerId])

  if (error) {
    return (
      <p className="rounded-portal-sm border border-red-100 bg-red-50/80 px-3 py-2 text-sm text-red-800">
        {error}
      </p>
    )
  }
  if (!items) {
    return <p className="text-sm text-neutral-500">Loading transactions…</p>
  }
  if (!items.length) {
    return <p className="text-sm text-neutral-500">No transactions on file.</p>
  }

  return (
    <ul className="divide-y divide-neutral-200/90 overflow-hidden rounded-portal border border-neutral-200/90 bg-white shadow-portal-card">
      {items.map((t, idx) => (
        <li
          key={`${t.date}-${t.type}-${idx}`}
          className="flex flex-wrap items-start gap-3 px-4 py-3 text-sm transition hover:bg-portal-filter-bg/50"
        >
          <span className="w-[92px] shrink-0 font-medium text-neutral-600">{t.date}</span>
          <span className="inline-flex shrink-0 rounded-full bg-portal-filter-bg px-2.5 py-0.5 text-xs font-semibold text-[#4A5F78] ring-1 ring-portal-filter-border/60">
            {t.type}
          </span>
          <span className="min-w-0 flex-1 leading-snug text-neutral-800">{t.description}</span>
        </li>
      ))}
    </ul>
  )
}
