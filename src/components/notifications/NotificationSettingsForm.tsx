// PURPOSE: Preferences form: Search bar + DataPreferencesForm. Search filters visible preference fields.
"use client";

import { useState } from "react";
import { SearchBar } from "@/components/ui/SearchBar";
import { DataPreferencesForm } from "./DataPreferencesForm";
import type { DataPreferences } from "@/types/preferences";

export function NotificationSettingsForm() {
  const [searchQuery, setSearchQuery] = useState("");
  // TODO: Load initialPreferences from API (e.g. GET /api/user/preferences)
  const initialPreferences: DataPreferences | null = null;

  const handleSave = (preferences: DataPreferences) => {
    // TODO: PATCH /api/user/preferences or alert rules
    void preferences;
  };

  return (
    <div className="space-y-6">
      <SearchBar
        placeholder="Search Preferences"
        showLeftIcon
        showSearchIcon
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        aria-label="Search Preferences"
      />
      <DataPreferencesForm
        initialPreferences={initialPreferences}
        onSave={handleSave}
        searchQuery={searchQuery}
      />
    </div>
  );
}
