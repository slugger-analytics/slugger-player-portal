"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Heart, Home, Menu, Pencil } from "lucide-react";

const navItems = [
  { href: "/dashboard", icon: Home, label: "Home" },
  { href: "/dashboard/favorites", icon: Heart, label: "Favorites" },
  { href: "/dashboard/updates", icon: Bell, label: "Updates" },
  { href: "/dashboard/preferences", icon: Pencil, label: "Preferences" },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-20 flex-col items-center gap-6 border-r border-slate-300 bg-slate-100 py-6">
      <button
        type="button"
        className="rounded p-2 text-slate-600 hover:bg-slate-200"
        aria-label="Menu"
      >
        <Menu className="h-6 w-6" />
      </button>
      <nav className="flex flex-1 flex-col items-center gap-8">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1.5 hover:text-slate-900 ${
                isActive ? "text-slate-900" : "text-slate-700"
              }`}
            >
              <Icon className="h-6 w-6" />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
