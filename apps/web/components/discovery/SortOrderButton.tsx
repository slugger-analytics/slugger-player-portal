"use client"

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, Plus } from "lucide-react"
import type { DiscoverySortOption } from "@/lib/discovery-query"

const OPTIONS: { value: DiscoverySortOption; label: string }[] = [
  { value: "newestTransaction", label: "Newest transactions (default)" },
  { value: "lastName", label: "Last name" },
  { value: "transactionType", label: "Transaction type" },
  { value: "ranking", label: "Ranking score" },
]

/** Label for aria and menu copy. */
function sortOptionLabel(sort: DiscoverySortOption): string {
  return OPTIONS.find((o) => o.value === sort)?.label ?? "Newest transactions (default)"
}

type Props = {
  sort: DiscoverySortOption
  onSelectSort: (next: DiscoverySortOption) => void
}

/**
 * Primary CTA + menu — matches “Add preferences” (Plus + label + Chevron, portal menu, h-11).
 */
export function SortOrderButton({ sort, onSelectSort }: Props) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null)

  function measureMenu() {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const gap = 6
    const edgePad = 8
    const vh = window.innerHeight
    const spaceBelow = vh - r.bottom - edgePad
    const spaceAbove = r.top - edgePad
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow
    const maxH = (openUp ? Math.min(320, spaceAbove) : Math.min(320, spaceBelow - gap)) || 200
    setMenuStyle(
      openUp
        ? {
            position: "fixed",
            left: r.left,
            width: Math.max(200, r.width),
            maxHeight: maxH,
            bottom: vh - r.top + gap,
            zIndex: 200,
          }
        : {
            position: "fixed",
            top: r.bottom + gap,
            left: r.left,
            width: Math.max(200, r.width),
            maxHeight: maxH,
            zIndex: 200,
          },
    )
  }

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null)
      return
    }
    measureMenu()
  }, [open])

  useEffect(() => {
    if (!open) return
    window.addEventListener("resize", measureMenu)
    document.addEventListener("scroll", measureMenu, true)
    return () => {
      window.removeEventListener("resize", measureMenu)
      document.removeEventListener("scroll", measureMenu, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null
      if (!t) return
      if (t.closest("[data-sort-order-root]") || t.closest("[data-sort-order-menu]")) return
      setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  return (
    <div className="relative" data-sort-order-root>
      <button
        ref={btnRef}
        type="button"
        id="sort-order-button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls="sort-order-menu"
        aria-label={`Sort: ${sortOptionLabel(sort)}`}
        onClick={() => setOpen((o) => !o)}
        className="portal-btn-primary inline-flex h-11 w-full items-center justify-center gap-2"
      >
        <Plus className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
        Sort
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open && menuStyle && typeof document !== "undefined"
        ? createPortal(
            <ul
              id="sort-order-menu"
              data-sort-order-menu
              role="listbox"
              aria-labelledby="sort-order-button"
              style={menuStyle}
              className="portal-menu m-0 max-h-[min(20rem,55dvh)] list-none py-1"
            >
              {OPTIONS.map(({ value, label }) => (
                <li key={value} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={sort === value}
                    className="portal-menu-item"
                    onClick={() => {
                      setOpen(false)
                      onSelectSort(value)
                    }}
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
    </div>
  )
}
