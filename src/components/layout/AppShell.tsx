// PURPOSE: Shared application shell for dashboard, priority-list, alerts, and settings.
// Renders left sidebar nav + main content area with top bar (user + settings).
// Use in layout files for routes that share this chrome. Lucide-React for all icons.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Home, Heart, Bell, Settings, User, Pencil, Clock } from "lucide-react";
import { type ReactNode } from "react";

/** Top bar shown above page content: user icon (left), settings icon (right). */
function TopBar() {
  return (
    <header
      className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white"
      role="banner"
    >
      {/* User / profile access — TODO: wire to auth and profile route */}
      <button
        type="button"
        className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
        aria-label="User profile"
      >
        <User className="w-5 h-5" />
      </button>
      {/* Global settings — TODO: link to /settings/notifications or settings hub */}
      <Link
        href="/settings/notifications"
        className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
        aria-label="Settings"
      >
        <Settings className="w-5 h-5" />
      </Link>
    </header>
  );
}

/** Single nav item: icon + label. Active state when href matches pathname. */
function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? "bg-navActive text-navActiveIcon"
          : "text-gray-600 hover:bg-gray-200"
      }`}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

/** Left sidebar: hamburger (collapse), then Home, Favorites, Updates, Preferences. */
function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="w-56 min-h-screen bg-sidebar flex flex-col border-r border-gray-200"
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Hamburger — TODO: collapse/expand on small screens; optional badge counts later */}
      <div className="p-3 border-b border-gray-200">
        <button
          type="button"
          className="p-2 rounded-lg hover:bg-gray-200 text-gray-600"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
      <nav className="flex flex-col gap-1 p-3">
        <NavItem
          href="/dashboard"
          label="Home"
          icon={Home}
          isActive={pathname === "/dashboard"}
        />
        <NavItem
          href="/priority-list"
          label="Favorites"
          icon={Heart}
          isActive={pathname === "/priority-list"}
        />
        <NavItem
          href="/dashboard/alerts"
          label="Updates"
          icon={Bell}
          isActive={pathname === "/dashboard/alerts"}
        />
        <NavItem
          href="/settings/notifications"
          label="Preferences"
          icon={Pencil}
          isActive={pathname.startsWith("/settings")}
        />
        <NavItem
          href="/history"
          label="History"
          icon={Clock}
          isActive={pathname === "/history"}
        />
      </nav>
    </aside>
  );
}

/** App shell: sidebar + main content area (top bar + children). */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <div className="flex-1 p-6 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
