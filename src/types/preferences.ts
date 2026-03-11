// PURPOSE: TypeScript types for user-selectable data preferences (filters and alert rules).
// Used by Preferences page, Player Discovery FilterBar, and API/export.

/** Keys for each selectable data preference. */
export type PreferenceKey =
  | "transactionDates"
  | "transactionTypes"
  | "transactionDescription"
  | "playersByName"
  | "mlbTeams"
  | "minorLeagueTeams"
  | "battingThrowingAverages"
  | "position"
  | "currentStatus"
  | "yearsActive"
  | "age"
  | "highLevel"
  | "lastXDays";

/** Date range: start and end (ISO date strings or null). */
export interface DateRange {
  start: string | null;
  end: string | null;
}

/** Numeric range (e.g. batting average, age). */
export interface NumberRange {
  min: number | null;
  max: number | null;
}

/** Value type for each preference key. */
export type PreferenceValue =
  | { key: "transactionDates"; value: DateRange }
  | { key: "transactionTypes"; value: string[] }
  | { key: "transactionDescription"; value: string }
  | { key: "playersByName"; value: string }
  | { key: "mlbTeams"; value: string[] }
  | { key: "minorLeagueTeams"; value: string[] }
  | { key: "battingThrowingAverages"; value: NumberRange }
  | { key: "position"; value: string[] }
  | { key: "currentStatus"; value: string[] }
  | { key: "yearsActive"; value: NumberRange }
  | { key: "age"; value: NumberRange }
  | { key: "highLevel"; value: string }
  | { key: "lastXDays"; value: number | null };

/** All preferences in one object for persistence/API. */
export interface DataPreferences {
  transactionDates?: DateRange | null;
  transactionTypes?: string[] | null;
  transactionDescription?: string | null;
  playersByName?: string | null;
  mlbTeams?: string[] | null;
  minorLeagueTeams?: string[] | null;
  battingThrowingAverages?: NumberRange | null;
  position?: string[] | null;
  currentStatus?: string[] | null;
  yearsActive?: NumberRange | null;
  age?: NumberRange | null;
  highLevel?: string | null;
  lastXDays?: number | null;
}
