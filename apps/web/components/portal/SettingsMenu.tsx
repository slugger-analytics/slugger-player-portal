"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Moon, Settings, Sun } from "lucide-react"
import { useTheme } from "@/components/portal/ThemeProvider"

type PanelPosition = { top: number; right: number }

/**
 * Header settings control: opens a small panel with light / dark appearance toggle.
 * Panel is portaled so it is not clipped by the pill’s overflow-hidden container.
 */
export function SettingsMenu() {
  const [open, setOpen] = useState(false)
  const [panelPos, setPanelPos] = useState<PanelPosition | null>(null)
  const { theme, setTheme } = useTheme()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null)
      return
    }
    const btn = buttonRef.current
    if (!btn) return
    const update = () => {
      const rect = btn.getBoundingClientRect()
      setPanelPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
    }
    update()
    window.addEventListener("resize", update)
    window.addEventListener("scroll", update, true)
    return () => {
      window.removeEventListener("resize", update)
      window.removeEventListener("scroll", update, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target
      if (!(t instanceof Node)) return
      if (rootRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  const panel =
    open && panelPos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Settings"
            className="fixed z-[100] w-[min(18rem,calc(100vw-2rem))] rounded-portal-sm border border-portal-chrome-border bg-portal-surface p-3 shadow-portal"
            style={{ top: panelPos.top, right: panelPos.right }}
          >
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Appearance
            </p>
            <div className="portal-tablist p-0.5" role="group" aria-label="Color theme">
              <button
                type="button"
                onClick={() => {
                  setTheme("light")
                  setOpen(false)
                }}
                className={`portal-tab flex items-center justify-center gap-2 ${
                  theme === "light" ? "portal-tab-active" : "portal-tab-inactive"
                }`}
              >
                <Sun className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                Light
              </button>
              <button
                type="button"
                onClick={() => {
                  setTheme("dark")
                  setOpen(false)
                }}
                className={`portal-tab flex items-center justify-center gap-2 ${
                  theme === "dark" ? "portal-tab-active" : "portal-tab-inactive"
                }`}
              >
                <Moon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                Dark
              </button>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-full p-2.5 text-neutral-500 transition hover:bg-white/85 hover:text-neutral-800 active:scale-[0.98] sm:p-3 dark:text-neutral-400 dark:hover:bg-neutral-800/65 dark:hover:text-neutral-100"
        aria-label="Settings"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Settings className="h-5 w-5" strokeWidth={1.75} />
      </button>
      {panel}
    </div>
  )
}
