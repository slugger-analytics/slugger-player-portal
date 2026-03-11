// PURPOSE: Single row in the Favorites list: drag handle + avatar + player info.
// Client Component for future drag-and-drop reorder; usePriorityList for state/mutations.
"use client";

import { GripVertical } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

export interface DraggablePlayerRowProps {
  /** Unique id for the list item (for reorder key and callbacks) */
  id: string;
  /** Display name or summary line */
  name?: string;
  /** Optional headshot URL */
  imageUrl?: string | null;
  /** Secondary line (e.g. position, team) — design shows "Info Info Info..." placeholder */
  subtitle?: string;
  /** Rank in list (1-based) for display — optional RankBadge */
  rank?: number;
}

export function DraggablePlayerRow({
  id,
  name = "Info Info Info Info Info",
  imageUrl,
  subtitle,
  rank,
}: DraggablePlayerRowProps) {
  return (
    <div
      role="listitem"
      data-id={id}
      className="flex items-center gap-4 p-4 bg-card rounded-card border border-gray-200 hover:border-gray-300 transition-colors"
    >
      {/* Drag handle — TODO: wire to dnd-kit or similar for reorder */}
      <button
        type="button"
        className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 cursor-grab active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-5 h-5" />
      </button>
      <Avatar
        src={imageUrl}
        alt={name}
        size="md"
        fallback={typeof name === "string" ? name.slice(0, 1) : undefined}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
        {subtitle && (
          <p className="text-sm text-gray-500 truncate">{subtitle}</p>
        )}
      </div>
      {rank != null && (
        <span className="text-xs font-medium text-gray-500 tabular-nums">
          #{rank}
        </span>
      )}
    </div>
  );
}
