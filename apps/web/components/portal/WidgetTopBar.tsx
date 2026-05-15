"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, Clock, Heart, Home, Pencil } from "lucide-react"
import type { ReactNode } from "react"
import { SettingsMenu } from "@/components/portal/SettingsMenu"

const navPillShell =
  "flex max-w-full flex-wrap items-stretch gap-1.5 rounded-full border border-neutral-200/90 bg-neutral-100/60 p-1.5 shadow-inner shadow-neutral-900/[0.03] dark:border-neutral-600/45 dark:bg-neutral-900/35 dark:shadow-none sm:flex-nowrap sm:gap-2 sm:overflow-x-auto sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden"

const navItemBase =
  "inline-flex min-h-[2.75rem] shrink-0 items-center justify-center gap-2.5 rounded-full px-3.5 text-[15px] font-semibold leading-snug tracking-tight transition-[color,background-color,box-shadow,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-950 sm:min-h-[3.15rem] sm:min-w-0 sm:flex-1 sm:basis-0 sm:px-4 sm:text-base"

const navItemIdle =
  "text-neutral-600 hover:bg-white/85 hover:text-neutral-900 active:scale-[0.98] dark:text-neutral-400 dark:hover:bg-neutral-800/65 dark:hover:text-neutral-100"

const navItemActive =
  "bg-portal-surface text-[#4A5F78] shadow-portal-card ring-1 ring-neutral-900/[0.06] dark:bg-neutral-800/95 dark:text-portal-accent dark:ring-white/10"

function NavLink({
  href,
  label,
  icon,
  activeMatch,
}: {
  href: string
  label: string
  icon: ReactNode
  activeMatch: (pathname: string) => boolean
}) {
  const pathname = usePathname()
  const active = activeMatch(pathname)
  return (
    <Link
      href={href}
      className={`${navItemBase} ${active ? navItemActive : navItemIdle}`}
      aria-current={active ? "page" : undefined}
    >
      <span
        aria-hidden
        className={`flex shrink-0 items-center justify-center [&_svg]:h-5 [&_svg]:w-5 [&_svg]:shrink-0 ${
          active ? "portal-text-accent" : "text-neutral-500 dark:text-neutral-500"
        }`}
      >
        {icon}
      </span>
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  )
}

/** Your filters & saved searches — kept next to app settings (common “account / app” pattern). */
function PreferencesSegmentedLink() {
  const pathname = usePathname()
  const active = pathname === "/preferences"
  return (
    <Link
      href="/preferences"
      className={`flex h-full min-w-0 flex-1 items-center justify-center gap-2 px-3 text-[15px] font-semibold transition sm:px-4 sm:text-base ${
        active
          ? "bg-portal-surface text-[#4A5F78] dark:bg-neutral-800/95 dark:text-portal-accent"
          : "text-neutral-600 hover:bg-white/75 dark:text-neutral-400 dark:hover:bg-neutral-800/50"
      }`}
      aria-current={active ? "page" : undefined}
    >
      <Pencil className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" strokeWidth={1.75} aria-hidden />
      <span className="whitespace-nowrap">Preferences</span>
    </Link>
  )
}

/**
 * Primary nav (Home → Updates) and a segmented **Preferences | Settings** group.
 * Separates “browse” from “configure” so the bar matches common app shell patterns.
 */
export function WidgetTopBar() {
  return (
    <header
      className="sticky top-0 z-40 border-b border-neutral-200/80 bg-portal-sidebar/80 backdrop-blur-xl backdrop-saturate-150 dark:border-neutral-700/55 dark:bg-portal-sidebar/75"
      role="banner"
    >
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3.5 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:py-4">
        <nav
          className={`${navPillShell} min-w-0 w-full sm:min-w-0 sm:flex-1`}
          aria-label="Primary navigation"
        >
          <NavLink
            href="/dashboard"
            label="Home"
            icon={<Home strokeWidth={1.75} aria-hidden />}
            activeMatch={(p) => p === "/dashboard"}
          />
          <NavLink
            href="/favorites"
            label="Favorites"
            icon={<Heart strokeWidth={1.75} aria-hidden />}
            activeMatch={(p) => p === "/favorites" || p.startsWith("/favorites/")}
          />
          <NavLink
            href="/history"
            label="History"
            icon={<Clock strokeWidth={1.75} aria-hidden />}
            activeMatch={(p) => p === "/history" || p.startsWith("/history/")}
          />
          <NavLink
            href="/updates"
            label="Updates"
            icon={<Bell strokeWidth={1.75} aria-hidden />}
            activeMatch={(p) => p === "/updates" || p.startsWith("/updates/")}
          />
        </nav>

        <div
          className="flex w-full min-w-0 items-center justify-center self-center sm:w-auto sm:max-w-none sm:shrink-0"
          aria-label="App and account"
        >
          <div
            className="flex h-[2.75rem] w-full max-w-lg overflow-hidden rounded-full border border-neutral-200/90 bg-neutral-100/60 dark:border-neutral-600/45 dark:bg-neutral-900/35 sm:h-[3.15rem] sm:w-auto"
          >
            <PreferencesSegmentedLink />
            <div
              className="w-px shrink-0 self-stretch bg-neutral-200/90 dark:bg-neutral-600/70"
              aria-hidden
            />
            <div className="flex shrink-0 items-center justify-center pr-0.5 sm:pl-0.5">
              <SettingsMenu />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
