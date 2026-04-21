import type { ReactNode } from "react"

/** Full-viewport shell for the widget app (page background only — no decorative browser frame). */
export function BrowserChrome({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-portal-page">{children}</div>
}
