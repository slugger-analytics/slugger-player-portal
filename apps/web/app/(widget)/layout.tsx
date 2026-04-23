/**
 * Widget route-group shell: top nav bar + main on the portal page background.
 * Use `portal-*` Tailwind tokens and `@layer components` helpers in `globals.css` on new screens.
 */

import type { ReactNode } from "react"
import { FavoritesProvider } from "@/components/favorites/FavoritesProvider"
import { UpdatesWatchProvider } from "@/components/updates/UpdatesWatchProvider"
import { BrowserChrome } from "@/components/portal/BrowserChrome"
import { WidgetTopBar } from "@/components/portal/WidgetTopBar"

export default function WidgetShellLayout({ children }: { children: ReactNode }) {
  return (
    <BrowserChrome>
      <FavoritesProvider>
        <UpdatesWatchProvider>
          <div className="flex min-h-screen flex-col">
            <WidgetTopBar />
            <div className="min-w-0 flex-1 bg-portal-main">{children}</div>
          </div>
        </UpdatesWatchProvider>
      </FavoritesProvider>
    </BrowserChrome>
  )
}
