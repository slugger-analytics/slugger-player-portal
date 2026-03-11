// PURPOSE: Client wrapper for Updates page: search state + filtered update list.
// Search bar filters updates by text content.
"use client";

import { useState, useMemo } from "react";
import { SearchBar } from "@/components/ui/SearchBar";
import { TransactionFeed } from "./TransactionFeed";

const MOCK_UPDATES = [
  { id: "1", text: "News Update info info info info", relativeTime: "1 min ago", imageUrl: null },
  { id: "2", text: "Info Info Info Info", relativeTime: "3 hours ago", imageUrl: null },
  { id: "3", text: "Info Info Info Info", relativeTime: "1 day ago", imageUrl: null },
];

export function AlertsPageClient() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUpdates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return MOCK_UPDATES;
    return MOCK_UPDATES.filter((u) => u.text.toLowerCase().includes(q));
  }, [searchQuery]);

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Updates</h1>
      <div className="mb-6">
        <SearchBar
          placeholder="Search Updates"
          showLeftIcon
          showSearchIcon
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search Updates"
        />
      </div>
      <TransactionFeed items={filteredUpdates} />
    </>
  );
}
