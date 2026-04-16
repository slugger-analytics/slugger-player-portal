// PURPOSE: Form that renders all selectable data preferences (Transaction Dates, Types, Players, etc.).
// Holds DataPreferences state and passes per-field value/onChange to PreferenceField.
"use client";

import { useState, useCallback } from "react";
import { PREFERENCE_DEFINITIONS } from "@/lib/preference-definitions";
import { PreferenceField } from "./PreferenceField";
import type { DataPreferences, PreferenceKey } from "@/types/preferences";

/** Get current value for a preference key from DataPreferences. */
function getPreferenceValue(
  prefs: DataPreferences,
  key: PreferenceKey
): unknown {
  switch (key) {
    case "transactionDates":
      return prefs.transactionDates ?? null;
    case "transactionTypes":
      return prefs.transactionTypes ?? null;
    case "transactionDescription":
      return prefs.transactionDescription ?? null;
    case "playersByName":
      return prefs.playersByName ?? null;
    case "mlbTeams":
      return prefs.mlbTeams ?? null;
    case "minorLeagueTeams":
      return prefs.minorLeagueTeams ?? null;
    case "battingThrowingAverages":
      return prefs.battingThrowingAverages ?? null;
    case "position":
      return prefs.position ?? null;
    case "currentStatus":
      return prefs.currentStatus ?? null;
    case "yearsActive":
      return prefs.yearsActive ?? null;
    case "age":
      return prefs.age ?? null;
    case "highLevel":
      return prefs.highLevel ?? null;
    case "lastXDays":
      return prefs.lastXDays ?? null;
    default:
      return null;
  }
}

/** Group definitions by category for section headers. */
const CATEGORIES: { title: string; keys: PreferenceKey[] }[] = [
  {
    title: "Transaction",
    keys: [
      "transactionDates",
      "transactionTypes",
      "transactionDescription",
    ],
  },
  {
    title: "Players & Teams",
    keys: [
      "playersByName",
      "mlbTeams",
      "minorLeagueTeams",
    ],
  },
  {
    title: "Stats & Demographics",
    keys: [
      "battingThrowingAverages",
      "position",
      "currentStatus",
      "yearsActive",
      "age",
      "highLevel",
    ],
  },
  {
    title: "Time Window",
    keys: ["lastXDays"],
  },
];

export interface DataPreferencesFormProps {
  /** Initial preferences (e.g. from API). */
  initialPreferences?: DataPreferences | null;
  /** Called when user saves. TODO: POST/PATCH to API. */
  onSave?: (preferences: DataPreferences) => void;
  /** When set, only show preference fields whose label/description matches (e.g. from Search Preferences). */
  searchQuery?: string;
}

function definitionMatchesQuery(def: { label: string; description?: string }, q: string): boolean {
  const lower = q.trim().toLowerCase();
  if (!lower) return true;
  return (
    def.label.toLowerCase().includes(lower) ||
    (def.description?.toLowerCase().includes(lower) ?? false)
  );
}

export function DataPreferencesForm({
  initialPreferences = null,
  onSave,
  searchQuery = "",
}: DataPreferencesFormProps) {
  const [prefs, setPrefs] = useState<DataPreferences>(() => ({
    ...initialPreferences,
  }));

  const handleChange = useCallback((key: PreferenceKey, value: unknown) => {
    setPrefs((prev) => {
      const next = { ...prev };
      switch (key) {
        case "transactionDates":
          next.transactionDates = value as DataPreferences["transactionDates"];
          break;
        case "transactionTypes":
          next.transactionTypes = value as DataPreferences["transactionTypes"];
          break;
        case "transactionDescription":
          next.transactionDescription =
            value as DataPreferences["transactionDescription"];
          break;
        case "playersByName":
          next.playersByName = value as DataPreferences["playersByName"];
          break;
        case "mlbTeams":
          next.mlbTeams = value as DataPreferences["mlbTeams"];
          break;
        case "minorLeagueTeams":
          next.minorLeagueTeams =
            value as DataPreferences["minorLeagueTeams"];
          break;
        case "battingThrowingAverages":
          next.battingThrowingAverages =
            value as DataPreferences["battingThrowingAverages"];
          break;
        case "position":
          next.position = value as DataPreferences["position"];
          break;
        case "currentStatus":
          next.currentStatus = value as DataPreferences["currentStatus"];
          break;
        case "yearsActive":
          next.yearsActive = value as DataPreferences["yearsActive"];
          break;
        case "age":
          next.age = value as DataPreferences["age"];
          break;
        case "highLevel":
          next.highLevel = value as DataPreferences["highLevel"];
          break;
        case "lastXDays":
          next.lastXDays = value as DataPreferences["lastXDays"];
          break;
        default:
          break;
      }
      return next;
    });
  }, []);

  const definitionsByKey = new Map(
    PREFERENCE_DEFINITIONS.map((d) => [d.key, d])
  );

  // Filter categories and keys by searchQuery
  const categoriesToShow = CATEGORIES.map((cat) => {
    const matchingKeys = cat.keys.filter((key) => {
      const def = definitionsByKey.get(key);
      return def && definitionMatchesQuery(def, searchQuery);
    });
    return { ...cat, keys: matchingKeys };
  }).filter((cat) => cat.keys.length > 0);

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        onSave?.(prefs);
      }}
    >
      {categoriesToShow.length > 0 ? (
        categoriesToShow.map((cat) => (
          <section key={cat.title} aria-labelledby={`section-${cat.title}`}>
            <h2
              id={`section-${cat.title}`}
              className="text-lg font-semibold text-gray-900 mb-4"
            >
              {cat.title}
            </h2>
            <div className="space-y-4">
              {cat.keys.map((key) => {
                const def = definitionsByKey.get(key);
                if (!def) return null;
                return (
                  <PreferenceField
                    key={def.key}
                    definition={def}
                    value={getPreferenceValue(prefs, key)}
                    onChange={handleChange}
                  />
                );
              })}
            </div>
          </section>
        ))
      ) : (
        <p className="text-sm text-gray-500 py-4">No preferences match your search.</p>
      )}

      {/* TODO: Wire to PATCH /api/user/preferences or alert rules */}
      {onSave && (
        <div className="pt-4">
          <button
            type="submit"
            className="px-4 py-2 bg-navActiveIcon text-white rounded-input font-medium text-sm hover:opacity-90"
          >
            Save preferences
          </button>
        </div>
      )}
    </form>
  );
}
