// PURPOSE: Metadata for each data preference: label, description, input type, and options for selects.
// Used by Preferences form and Add-Preference UI to render the correct control.
import type { PreferenceKey } from "@/types/preferences";

export type PreferenceInputType =
  | "date-range"
  | "multi-select"
  | "keyword"
  | "number-range"
  | "single-select"
  | "number";

export interface PreferenceDefinition {
  key: PreferenceKey;
  label: string;
  description?: string;
  inputType: PreferenceInputType;
  /** Options for multi-select or single-select (e.g. position, current status, transaction types). */
  options?: { value: string; label: string }[];
  /** Placeholder for text inputs. */
  placeholder?: string;
  /** Min/max hints for number or number-range. */
  min?: number;
  max?: number;
  /** Optional: e.g. "Last X Days" is marked optional in product. */
  optional?: boolean;
}

/** Transaction Types — common transaction type options. TODO: sync with backend/feed taxonomy. */
const TRANSACTION_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "released", label: "Released" },
  { value: "signed", label: "Signed" },
  { value: "traded", label: "Traded" },
  { value: "optioned", label: "Optioned" },
  { value: "designated", label: "Designated for Assignment" },
  { value: "waived", label: "Waived" },
  { value: "retired", label: "Retired" },
  { value: "other", label: "Other" },
];

/** Position options. */
const POSITION_OPTIONS: { value: string; label: string }[] = [
  { value: "P", label: "Pitcher" },
  { value: "C", label: "Catcher" },
  { value: "1B", label: "First Base" },
  { value: "2B", label: "Second Base" },
  { value: "3B", label: "Third Base" },
  { value: "SS", label: "Shortstop" },
  { value: "LF", label: "Left Field" },
  { value: "CF", label: "Center Field" },
  { value: "RF", label: "Right Field" },
  { value: "DH", label: "Designated Hitter" },
  { value: "OF", label: "Outfielder" },
];

/** Current Status options. */
const CURRENT_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "playing", label: "Playing" },
  { value: "injured", label: "Injured" },
  { value: "retired", label: "Retired" },
  { value: "free-agent", label: "Free Agent" },
  { value: "restricted", label: "Restricted" },
];

/** High Level — highest level played (e.g. MLB, AAA). TODO: populate from backend. */
const HIGH_LEVEL_OPTIONS: { value: string; label: string }[] = [
  { value: "MLB", label: "MLB" },
  { value: "AAA", label: "AAA" },
  { value: "AA", label: "AA" },
  { value: "A+", label: "High-A" },
  { value: "A", label: "Single-A" },
  { value: "Ind", label: "Independent" },
  { value: "Other", label: "Other" },
];

/** All preference definitions in display order, grouped by category. */
export const PREFERENCE_DEFINITIONS: PreferenceDefinition[] = [
  // —— Transaction ——
  {
    key: "transactionDates",
    label: "Transaction Date(s)",
    description: "Filter by date range for transactions.",
    inputType: "date-range",
  },
  {
    key: "transactionTypes",
    label: "Transaction Types",
    description: "Include only these transaction types (e.g. Released, Signed).",
    inputType: "multi-select",
    options: TRANSACTION_TYPE_OPTIONS,
  },
  {
    key: "transactionDescription",
    label: "Transaction Description",
    description: "Search for keywords in transaction descriptions.",
    inputType: "keyword",
    placeholder: "e.g. optioned, designated",
  },
  // —— Player ——
  {
    key: "playersByName",
    label: "Players (by Name)",
    description: "Search by player name.",
    inputType: "keyword",
    placeholder: "Player name",
  },
  // —— Teams ——
  {
    key: "mlbTeams",
    label: "MLB Teams",
    description: "Filter by MLB team(s).",
    inputType: "multi-select",
    options: [], // TODO: fetch from API
    placeholder: "Select MLB teams",
  },
  {
    key: "minorLeagueTeams",
    label: "Minor League Teams",
    description: "Filter by minor league team(s).",
    inputType: "multi-select",
    options: [], // TODO: fetch from API
    placeholder: "Select minor league teams",
  },
  // —— Stats / Demographics ——
  {
    key: "battingThrowingAverages",
    label: "Batting/Throwing Averages",
    description: "Filter by batting or throwing average range (e.g. 0.250 – 0.350).",
    inputType: "number-range",
    min: 0,
    max: 1,
    placeholder: "Min – Max",
  },
  {
    key: "position",
    label: "Position",
    description: "Filter by position(s).",
    inputType: "multi-select",
    options: POSITION_OPTIONS,
  },
  {
    key: "currentStatus",
    label: "Current Status",
    description: "e.g. injured, playing, retired.",
    inputType: "multi-select",
    options: CURRENT_STATUS_OPTIONS,
  },
  {
    key: "yearsActive",
    label: "Years Active",
    description: "Number of years active (range).",
    inputType: "number-range",
    min: 0,
    max: 30,
  },
  {
    key: "age",
    label: "Age (current)",
    description: "Current age range.",
    inputType: "number-range",
    min: 16,
    max: 50,
  },
  {
    key: "highLevel",
    label: "High Level",
    description: "Highest level played (e.g. MLB, AAA).",
    inputType: "single-select",
    options: HIGH_LEVEL_OPTIONS,
  },
  {
    key: "lastXDays",
    label: "Last X Days",
    description: "Days before selected date (optional). Only show transactions from the last X days.",
    inputType: "number",
    min: 1,
    max: 365,
    optional: true,
  },
];

/** Lookup by key. */
export function getPreferenceDefinition(
  key: PreferenceKey
): PreferenceDefinition | undefined {
  return PREFERENCE_DEFINITIONS.find((d) => d.key === key);
}
