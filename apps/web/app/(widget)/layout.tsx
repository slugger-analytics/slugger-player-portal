/**
 * Widget route-group shell: browser chrome mock, steel blue accent, sidebar + main.
 * Matches the Player Discovery Home mockup; use `portal-*` Tailwind tokens and
 * `@layer components` helpers in `globals.css` on new screens.
 */

import {
  Bell,
  Clock,
  Heart,
  Home,
  Menu,
  Pencil,
  Settings,
  UserRound,
} from "lucide-react"
import type { ReactNode } from "react"
import { BrowserChrome } from "@/components/portal/BrowserChrome"

export default function WidgetShellLayout({ children }: { children: ReactNode }) {
  return (
    <BrowserChrome>
      <div className="flex min-h-[min(100vh-10rem,900px)]">
        <aside
          className="flex w-[80px] shrink-0 flex-col items-center gap-6 border-r border-neutral-200/90 bg-portal-sidebar py-5"
          aria-label="Primary navigation"
        >
          <button
            type="button"
            className="rounded-lg p-1 text-neutral-500 transition hover:bg-white/80 hover:text-neutral-800"
            aria-label="Menu"
          >
            <Menu className="h-6 w-6" strokeWidth={2} />
          </button>
          <div className="flex h-12 w-12 items-center justify-center rounded-portal-sm bg-white shadow-portal-nav">
            <Home className="h-6 w-6 text-[#4A5F78]" strokeWidth={2} aria-hidden />
          </div>
          <NavIcon label="Favorites" icon={<Heart className="h-6 w-6" />} />
          <NavIcon label="Updates" icon={<Bell className="h-6 w-6" />} />
          <NavIcon label="Preferences" icon={<Pencil className="h-6 w-6" />} />
          <NavIcon label="History" icon={<Clock className="h-6 w-6" />} />
        </aside>
        <div className="min-w-0 flex-1 bg-white">
          <header className="flex items-start justify-between px-4 pb-1 pt-5 sm:px-5">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-neutral-500"
              aria-hidden
            >
              <UserRound className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <button
              type="button"
              className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
              aria-label="Settings"
            >
              <Settings className="h-6 w-6" strokeWidth={1.5} />
            </button>
          </header>
          {children}
        </div>
      </div>
    </BrowserChrome>
  )
}

function NavIcon({ label, icon }: { label: string; icon: ReactNode }) {
  return (
    <button
      type="button"
      className="flex flex-col items-center gap-1.5 rounded-lg p-1 text-neutral-500 transition hover:bg-white/80 hover:text-neutral-700"
    >
      <span aria-hidden>{icon}</span>
      <span className="max-w-[72px] text-center text-[10px] font-medium leading-tight text-neutral-500">
        {label}
      </span>
    </button>
  )
}
