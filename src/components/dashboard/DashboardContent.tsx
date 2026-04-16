// PURPOSE: Client-side dashboard content: FilterBar (with filter state) + player list area.
// Uses usePlayerFilters for state; data for PlayerCards to be supplied by parent (Server) or API.
"use client";

import { usePlayerFilters } from "@/hooks/usePlayerFilters";
import { FilterBar } from "./FilterBar";
import { PlayerCard } from "./PlayerCard";
import type { ActiveFilter } from "./FilterBar";

export interface DashboardContentProps {
  /** Initial filters to show (e.g. from URL or saved prefs) — TODO: from server */
  initialFilters?: ActiveFilter[];
  /** Player list to display — TODO: from Server Component or API; empty for now */
  players?: Array<{
    id: string;
    name: string;
    imageUrl?: string | null;
    primaryInfo?: string;
    secondaryInfo?: string;
    availabilityStatus?: string;
  }>;
}

export function DashboardContent({
  initialFilters = [],
  players = [],
}: DashboardContentProps) {
  const { filters, addFilter, onFilterMenuClick } = usePlayerFilters(
    initialFilters
  );

  return (
    <div className="space-y-6">
      <FilterBar
        filters={filters}
        addPlaceholder="Add Preferences"
        onAddPreference={(preference) =>
          addFilter({
            key: preference.key,
            label: preference.label,
            value: preference.value,
          })
        }
        onFilterMenuClick={onFilterMenuClick}
      />
      {/* Player list or empty state (design shows placeholder image area) */}
      <section aria-label="Player discovery results" className="mt-6">
        {players.length > 0 ? (
          <ul className="space-y-2">
            {players.map((p) => (
              <li key={p.id}>
                <PlayerCard
                  name={p.name}
                  imageUrl={p.imageUrl}
                  primaryInfo={p.primaryInfo}
                  secondaryInfo={p.secondaryInfo}
                  availabilityStatus={p.availabilityStatus}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex gap-8 items-start">
            <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 bg-card rounded-card border border-gray-200 min-h-[280px]">
              <p className="text-sm text-gray-500 text-center">
                Add preferences above to discover players. Results will appear here.
              </p>
            </div>
            {/* Placeholder for player image (design: baseball player on right) */}
            <div
              className="shrink-0 w-40 h-40 rounded-card bg-inputBg border border-gray-200 flex items-center justify-center overflow-hidden"
              aria-hidden
            >
              <span className="text-4xl text-gray-400" aria-hidden>⚾</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
