/**
 * Widget route-group shell: browser chrome mock, steel blue accent, sidebar + main.
 * Matches the Player Discovery Home mockup; use `portal-*` Tailwind tokens and
 * `@layer components` helpers in `globals.css` on new screens.
 */

import { Settings, UserRound } from "lucide-react"
import type { ReactNode } from "react"
import { FavoritesProvider } from "@/components/favorites/FavoritesProvider"
import { BrowserChrome } from "@/components/portal/BrowserChrome"
import { WidgetSidebar } from "@/components/portal/WidgetSidebar"

export default function WidgetShellLayout({ children }: { children: ReactNode }) {
  return (
    <BrowserChrome>
      <FavoritesProvider>
        <div className="flex min-h-[min(100vh-10rem,900px)]">
          <WidgetSidebar />
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
      </FavoritesProvider>
    </BrowserChrome>
  )
}
