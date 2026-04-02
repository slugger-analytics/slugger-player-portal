import type { ReactNode } from "react"

/**
 * Decorative browser window frame + steel-blue accent strip below the title bar.
 * Wraps the sidebar + main column so the app matches the Player Discovery mockup.
 */
export function BrowserChrome({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-portal-page px-3 py-5 sm:px-4 sm:py-8">
      <div className="mx-auto w-full max-w-[min(100vw-1.5rem,72rem)] overflow-hidden rounded-portal-lg border border-portal-chrome-border bg-portal-main shadow-portal">
        <div
          className="flex items-center gap-3 border-b border-portal-chrome-border bg-portal-chrome px-3 py-2.5 sm:px-4"
          aria-hidden
        >
          <div className="flex shrink-0 gap-1.5 pl-0.5">
            <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
            <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
            <span className="h-3 w-3 rounded-full bg-[#28C840]" />
          </div>
          <div className="min-w-0 flex-1 rounded-lg border border-neutral-200/60 bg-portal-surface/95 px-3 py-1.5 text-center text-xs font-medium text-neutral-500 shadow-sm dark:border-neutral-600/50 dark:text-neutral-400">
            Player Discovery Portal
          </div>
        </div>
        <div className="h-2 w-full bg-portal-accent" aria-hidden />
        {children}
      </div>
    </div>
  )
}
