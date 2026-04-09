/**
 * Widget route-group shell: browser chrome mock, steel blue accent, sidebar + main.
 * Matches the Player Discovery Home mockup; use `portal-*` Tailwind tokens and
 * `@layer components` helpers in `globals.css` on new screens.
 */

import { UserRound } from "lucide-react"
import type { ReactNode } from "react"
import { FavoritesProvider } from "@/components/favorites/FavoritesProvider"
import { UpdatesWatchProvider } from "@/components/updates/UpdatesWatchProvider"
import { BrowserChrome } from "@/components/portal/BrowserChrome"
import { SettingsMenu } from "@/components/portal/SettingsMenu"
import { WidgetSidebar } from "@/components/portal/WidgetSidebar"

export default function WidgetShellLayout({ children }: { children: ReactNode }) {
  return (
    <BrowserChrome>
      <FavoritesProvider>
        <UpdatesWatchProvider>
        <div className="flex min-h-[min(100vh-10rem,900px)]">
          <WidgetSidebar />
          <div className="min-w-0 flex-1 bg-portal-main">
            <header className="flex items-start justify-between px-4 pb-0 pt-3 sm:px-5">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-600 dark:bg-neutral-800/80 dark:text-neutral-400"
                aria-hidden
              >
                <UserRound className="h-6 w-6" strokeWidth={1.5} />
              </div>
              <SettingsMenu />
            </header>
            {children}
          </div>
        </div>
        </UpdatesWatchProvider>
      </FavoritesProvider>
    </BrowserChrome>
  )
}
