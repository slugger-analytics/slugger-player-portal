"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, Clock, Heart, Home, Pencil } from "lucide-react"
import type { ReactNode } from "react"

function NavLink({
  href,
  label,
  icon,
  activeMatch,
  homeStyle,
}: {
  href: string
  label: string
  icon: ReactNode
  activeMatch: (pathname: string) => boolean
  homeStyle?: boolean
}) {
  const pathname = usePathname()
  const active = activeMatch(pathname)
  const iconWrap = homeStyle ? (
    <div className="flex h-12 w-12 items-center justify-center rounded-portal-sm bg-portal-surface shadow-portal-nav dark:shadow-none">
      {icon}
    </div>
  ) : (
    <span className={active ? "text-[#4A5F78] dark:text-portal-accent" : "text-neutral-500 dark:text-neutral-400"}>
      {icon}
    </span>
  )
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-1.5 rounded-lg p-1 transition hover:bg-portal-chrome/80 dark:hover:bg-neutral-800/60 ${
        active && !homeStyle
          ? "text-[#4A5F78] dark:text-portal-accent"
          : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
      }`}
    >
      <span aria-hidden>{iconWrap}</span>
      <span className="max-w-[72px] text-center text-[10px] font-medium leading-tight">{label}</span>
    </Link>
  )
}

export function WidgetSidebar() {
  const pathname = usePathname()
  return (
    <aside
      className="flex w-[80px] shrink-0 flex-col items-center gap-4 border-r border-neutral-200/90 bg-portal-sidebar pt-4 pb-5 dark:border-neutral-700/80"
      aria-label="Primary navigation"
    >
      <NavLink
        href="/dashboard"
        label="Home"
        homeStyle
        icon={<Home className="h-6 w-6 text-[#4A5F78] dark:text-portal-accent" strokeWidth={2} aria-hidden />}
        activeMatch={(p) => p === "/dashboard"}
      />
      <NavLink
        href="/favorites"
        label="Favorites"
        icon={<Heart className="h-6 w-6" strokeWidth={2} aria-hidden />}
        activeMatch={(p) => p === "/favorites" || p.startsWith("/favorites/")}
      />
      <NavLink
        href="/history"
        label="History"
        icon={<Clock className="h-6 w-6" strokeWidth={2} aria-hidden />}
        activeMatch={(p) => p === "/history" || p.startsWith("/history/")}
      />
      <NavLink
        href="/updates"
        label="Updates"
        icon={<Bell className="h-6 w-6" strokeWidth={2} aria-hidden />}
        activeMatch={(p) => p === "/updates" || p.startsWith("/updates/")}
      />
      <Link
        href="/preferences"
        className={`flex flex-col items-center gap-1.5 rounded-lg p-1 transition hover:bg-portal-chrome/80 hover:text-neutral-700 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-200 ${
          pathname === "/preferences"
            ? "text-[#4A5F78] dark:text-portal-accent"
            : "text-neutral-500 dark:text-neutral-400"
        }`}
      >
        <span aria-hidden>
          <Pencil className="h-6 w-6" strokeWidth={2} />
        </span>
        <span className="max-w-[72px] text-center text-[10px] font-medium leading-tight">Preferences</span>
      </Link>
    </aside>
  )
}
