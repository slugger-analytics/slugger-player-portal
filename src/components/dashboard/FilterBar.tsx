// PURPOSE: Filter controls for Player Discovery — "Add Preferences" search + filter chips.
// When you search/focus the bar, a dropdown appears with preference types; selecting one opens the add modal.
"use client";

import { useState, useRef, useEffect } from "react";
import { Plus } from "lucide-react";
import { SearchBar } from "@/components/ui/SearchBar";
import { FilterChip } from "@/components/ui/FilterChip";
import { Button } from "@/components/ui/Button";
import { AddPreferenceModal } from "./AddPreferenceModal";
import { PREFERENCE_DEFINITIONS } from "@/lib/preference-definitions";
import type { PreferenceKey } from "@/types/preferences";

/** Single active filter for display in the bar (e.g. Position: Pitcher). */
export interface ActiveFilter {
  id: string;
  label: string;
  shortcut?: string;
  /** Optional: structured key for API/export (from AddPreferenceModal). */
  preferenceKey?: PreferenceKey;
  /** Optional: raw value for API/export. */
  value?: unknown;
}

export interface FilterBarProps {
  /** Current active filters to show as chips */
  filters: ActiveFilter[];
  /** Placeholder for the search/add input (default: "Add Preferences") */
  addPlaceholder?: string;
  /** Called when user adds a structured preference from the modal */
  onAddPreference?: (preference: { key: PreferenceKey; label: string; value: unknown }) => void;
  /** Called when user opens menu on a chip (edit/remove) — TODO: open dropdown */
  onFilterMenuClick?: (filterId: string) => void;
}

export function FilterBar({
  filters,
  addPlaceholder = "Add Preferences",
  onAddPreference,
  onFilterMenuClick,
}: FilterBarProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedPreferenceKey, setSelectedPreferenceKey] = useState<PreferenceKey | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleAddFromModal = (preference: { key: PreferenceKey; label: string; value: unknown }) => {
    onAddPreference?.(preference);
  };

  // Filter preference types by search query (label)
  const filteredPreferences = PREFERENCE_DEFINITIONS.filter((def) =>
    def.label.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectPreference = (key: PreferenceKey) => {
    setSelectedPreferenceKey(key);
    setModalOpen(true);
    setDropdownOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="space-y-4">
      {/* Active filter chips (e.g. "Position: Pitcher", "Age: 18 – 25") */}
      {filters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <FilterChip
              key={f.id}
              label={f.label}
              shortcut={f.shortcut}
              onMenuClick={() => onFilterMenuClick?.(f.id)}
            />
          ))}
        </div>
      )}
      {/* Add-preference row: search bar (with dropdown on focus/type) + circular add button */}
      <div className="flex items-center gap-3">
        <div ref={containerRef} className="flex-1 min-w-0 relative">
          <SearchBar
            placeholder={addPlaceholder}
            showLeftIcon
            showSearchIcon
            aria-label={addPlaceholder}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setDropdownOpen(true);
            }}
            onFocus={() => setDropdownOpen(true)}
          />
          {/* Dropdown: list of preference types (filtered by search); appears below the search bar */}
          {dropdownOpen && (
            <div
              className="absolute top-full left-0 right-0 z-10 mt-1 py-1 bg-white rounded-input border border-gray-200 shadow-lg max-h-64 overflow-y-auto"
              role="listbox"
              aria-label="Preference types"
            >
              {filteredPreferences.length > 0 ? (
                filteredPreferences.map((def) => (
                  <button
                    key={def.key}
                    type="button"
                    role="option"
                    className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                    onClick={() => handleSelectPreference(def.key)}
                  >
                    {def.label}
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-sm text-gray-500">No matching preferences</p>
              )}
            </div>
          )}
        </div>
        <Button
          type="button"
          aria-label="Add preference"
          className="flex shrink-0 w-12 h-12 rounded-full bg-navActive text-navActiveIcon hover:bg-sky-200 flex items-center justify-center transition-colors"
          onClick={() => {
            setSelectedPreferenceKey(null);
            setModalOpen(true);
          }}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      <AddPreferenceModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedPreferenceKey(null);
        }}
        onAdd={handleAddFromModal}
        initialPreferenceKey={selectedPreferenceKey}
      />
    </div>
  );
}
