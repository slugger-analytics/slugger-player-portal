/**
 * Widget route-group shell: sidebar + main on the portal page background.
 * Use `portal-*` Tailwind tokens and `@layer components` helpers in `globals.css` on new screens.
 */

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
        <div className="flex min-h-screen">
          <WidgetSidebar />
          <div className="min-w-0 flex-1 bg-portal-main">
            <header className="flex items-start justify-end px-4 pb-0 pt-3 sm:px-5">
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
