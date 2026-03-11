// PURPOSE: Filter state management for position, team, and availability status (Client).
// Used by dashboard FilterBar and list filtering. Supports structured preferences (key + value) for API.
"use client";

import { useState, useCallback } from "react";
import type { ActiveFilter } from "@/components/dashboard/FilterBar";
import type { PreferenceKey } from "@/types/preferences";

export interface UsePlayerFiltersReturn {
  filters: ActiveFilter[];
  /** Add a filter by label only (legacy) or with structured preference key/value. */
  addFilter: (
    labelOrPreference: string | { key: PreferenceKey; label: string; value: unknown },
    shortcut?: string
  ) => void;
  removeFilter: (id: string) => void;
  onFilterMenuClick: (id: string) => void;
}

let filterIdCounter = 0;
function nextId() {
  return `filter-${++filterIdCounter}`;
}

export function usePlayerFilters(
  initialFilters: ActiveFilter[] = []
): UsePlayerFiltersReturn {
  const [filters, setFilters] = useState<ActiveFilter[]>(initialFilters);

  const addFilter = useCallback(
    (
      labelOrPreference: string | { key: PreferenceKey; label: string; value: unknown },
      shortcut?: string
    ) => {
      if (typeof labelOrPreference === "string") {
        setFilters((prev) => [
          ...prev,
          { id: nextId(), label: labelOrPreference || "New filter", shortcut },
        ]);
      } else {
        const { key, label, value } = labelOrPreference;
        setFilters((prev) => [
          ...prev,
          {
            id: nextId(),
            label: label || "New filter",
            shortcut,
            preferenceKey: key,
            value,
          },
        ]);
      }
    },
    []
  );

  const removeFilter = useCallback((id: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const onFilterMenuClick = useCallback((id: string) => {
    // TODO: open dropdown to edit or remove filter; for now no-op
    void id;
  }, []);

  return { filters, addFilter, removeFilter, onFilterMenuClick };
}
