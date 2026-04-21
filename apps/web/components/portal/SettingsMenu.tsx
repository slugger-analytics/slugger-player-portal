"use client"

import { useEffect, useRef, useState } from "react"
import { Moon, Settings, Sun } from "lucide-react"
import { useTheme } from "@/components/portal/ThemeProvider"

/**
 * Header settings control: opens a small panel with light / dark appearance toggle.
 */
export function SettingsMenu() {
  const [open, setOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const el = rootRef.current
      if (!el || !(e.target instanceof Node) || el.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        aria-label="Settings"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Settings className="h-6 w-6" strokeWidth={1.5} />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Settings"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-[min(18rem,calc(100vw-2rem))] rounded-portal-sm border border-portal-chrome-border bg-portal-surface p-3 shadow-portal"
        >
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Appearance
          </p>
          <div className="portal-tablist p-0.5" role="group" aria-label="Color theme">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`portal-tab flex items-center justify-center gap-2 ${
                theme === "light" ? "portal-tab-active" : "portal-tab-inactive"
              }`}
            >
              <Sun className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              Light
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`portal-tab flex items-center justify-center gap-2 ${
                theme === "dark" ? "portal-tab-active" : "portal-tab-inactive"
              }`}
            >
              <Moon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              Dark
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
