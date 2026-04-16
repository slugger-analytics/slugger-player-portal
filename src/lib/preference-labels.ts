// PURPOSE: Format preference value into a short display label for filter chips (e.g. "Position: P, 1B").
import { getPreferenceDefinition } from "./preference-definitions";
import type { PreferenceKey } from "@/types/preferences";

export function formatPreferenceLabel(key: PreferenceKey, value: unknown): string {
  const def = getPreferenceDefinition(key);
  const label = def?.label ?? key;

  if (value == null || (Array.isArray(value) && value.length === 0)) {
    return label;
  }

  if (Array.isArray(value)) {
    const options = def?.options;
    const names = options
      ? (value as string[]).map((v) => options.find((o) => o.value === v)?.label ?? v)
      : (value as string[]);
    return `${label}: ${names.join(", ")}`;
  }

  if (typeof value === "object" && "min" in value && "max" in value) {
    const r = value as { min: number | null; max: number | null };
    if (r.min != null && r.max != null) return `${label}: ${r.min} – ${r.max}`;
    if (r.min != null) return `${label}: ≥ ${r.min}`;
    if (r.max != null) return `${label}: ≤ ${r.max}`;
    return label;
  }

  if (typeof value === "object" && "start" in value && "end" in value) {
    const d = value as { start: string | null; end: string | null };
    if (d.start && d.end) return `${label}: ${d.start} – ${d.end}`;
    if (d.start) return `${label}: from ${d.start}`;
    if (d.end) return `${label}: until ${d.end}`;
    return label;
  }

  if (typeof value === "string" && value.trim()) return `${label}: ${value.trim()}`;
  if (typeof value === "number") return `${label}: ${value}`;

  return label;
}
