// PURPOSE: Client wrapper for Favorites page: search state + filtered list.
// Search bar filters the displayed rows by name or subtitle.
"use client";

import { useState, useMemo } from "react";
import { PriorityListHeader } from "./PriorityListHeader";
import { SearchBar } from "@/components/ui/SearchBar";
import { DraggablePlayerRow } from "./DraggablePlayerRow";

const MOCK_ENTRIES = [
  { id: "1", name: "Info Info Info Info Info", subtitle: "Position · Team", rank: 1 },
  { id: "2", name: "Info Info Info Info Info", subtitle: "Position · Team", rank: 2 },
  { id: "3", name: "Info Info Info Info Info", subtitle: "Position · Team", rank: 3 },
];

export function PriorityListPageClient() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return MOCK_ENTRIES;
    return MOCK_ENTRIES.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.subtitle && e.subtitle.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  return (
    <>
      <PriorityListHeader title="Favorites" />
      <div className="mb-6">
        <SearchBar
          placeholder="Search Favorites"
          showLeftIcon
          showSearchIcon
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search Favorites"
        />
      </div>
      <ul className="space-y-2" role="list" aria-label="Favorites list">
        {filteredEntries.length > 0 ? (
          filteredEntries.map((entry) => (
            <li key={entry.id}>
              <DraggablePlayerRow
                id={entry.id}
                name={entry.name}
                subtitle={entry.subtitle}
                rank={entry.rank}
              />
            </li>
          ))
        ) : (
          <li className="py-8 text-center text-sm text-gray-500 bg-card rounded-card border border-gray-200">
            No favorites match your search.
          </li>
        )}
      </ul>
    </>
  );
}
