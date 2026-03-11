// PURPOSE: Header for Favorites (priority list): title and optional actions (e.g. settings).
// Uses Lucide-React for icons. Matches Figma: "Favorites" title, settings cog top-right in content.
import { Settings } from "lucide-react";
import Link from "next/link";

export interface PriorityListHeaderProps {
  title?: string;
}

export function PriorityListHeader({ title = "Favorites" }: PriorityListHeaderProps) {
  return (
    <header className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <Link
        href="/settings/notifications"
        className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
        aria-label="Settings"
      >
        <Settings className="w-5 h-5" />
      </Link>
    </header>
  );
}
