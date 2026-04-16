// PURPOSE: Renders the appropriate input for a single data preference (date range, multi-select, keyword, etc.).
// Used by Preferences page and (optionally) Add-Preference modal on dashboard.
"use client";

import { useId } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { PreferenceDefinition } from "@/lib/preference-definitions";

export interface PreferenceFieldProps {
  definition: PreferenceDefinition;
  /** Current value (from DataPreferences). */
  value: unknown;
  /** Called when value changes. Caller maps key + value into DataPreferences. */
  onChange: (key: PreferenceDefinition["key"], value: unknown) => void;
}

/** Keyword (single text) input. */
function KeywordField({
  id,
  definition,
  value,
  onChange,
}: {
  id: string;
  definition: PreferenceDefinition;
  value: unknown;
  onChange: (v: string) => void;
}) {
  const str = typeof value === "string" ? value : "";
  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        placeholder={definition.placeholder ?? definition.label}
        value={str}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pr-8"
      />
      {str && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-600"
          aria-label="Clear"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/** Number range: min and max inputs. */
function NumberRangeField({
  id,
  definition,
  value,
  onChange,
}: {
  id: string;
  definition: PreferenceDefinition;
  value: unknown;
  onChange: (v: { min: number | null; max: number | null }) => void;
}) {
  const range = value && typeof value === "object" && "min" in value && "max" in value
    ? (value as { min: number | null; max: number | null })
    : { min: null, max: null };
  const minNum = range.min ?? "";
  const maxNum = range.max ?? "";
  const min = definition.min ?? 0;
  const max = definition.max ?? 100;

  return (
    <div className="flex items-center gap-2">
      <Input
        id={`${id}-min`}
        type="number"
        placeholder="Min"
        min={min}
        max={max}
        value={minNum === "" ? "" : String(minNum)}
        onChange={(e) => {
          const v = e.target.value === "" ? null : Number(e.target.value);
          onChange({ min: v, max: range.max });
        }}
        className="w-full"
      />
      <span className="text-gray-500 text-sm">–</span>
      <Input
        id={`${id}-max`}
        type="number"
        placeholder="Max"
        min={min}
        max={max}
        value={maxNum === "" ? "" : String(maxNum)}
        onChange={(e) => {
          const v = e.target.value === "" ? null : Number(e.target.value);
          onChange({ min: range.min, max: v });
        }}
        className="w-full"
      />
    </div>
  );
}

/** Date range: start and end date inputs (native type="date"). */
function DateRangeField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: unknown;
  onChange: (v: { start: string | null; end: string | null }) => void;
}) {
  const range = value && typeof value === "object" && "start" in value && "end" in value
    ? (value as { start: string | null; end: string | null })
    : { start: null, end: null };

  return (
    <div className="flex items-center gap-2">
      <Input
        id={`${id}-start`}
        type="date"
        value={range.start ?? ""}
        onChange={(e) =>
          onChange({ start: e.target.value || null, end: range.end })
        }
        className="w-full"
      />
      <span className="text-gray-500 text-sm">–</span>
      <Input
        id={`${id}-end`}
        type="date"
        value={range.end ?? ""}
        onChange={(e) =>
          onChange({ start: range.start, end: e.target.value || null })
        }
        className="w-full"
      />
    </div>
  );
}

/** Single number (e.g. Last X Days). */
function NumberField({
  id,
  definition,
  value,
  onChange,
}: {
  id: string;
  definition: PreferenceDefinition;
  value: unknown;
  onChange: (v: number | null) => void;
}) {
  const num = typeof value === "number" ? value : "";
  return (
    <Input
      id={id}
      type="number"
      min={definition.min ?? 0}
      max={definition.max ?? 365}
      placeholder={definition.placeholder ?? definition.label}
      value={num === "" ? "" : String(num)}
      onChange={(e) => {
        const v = e.target.value === "" ? null : Number(e.target.value);
        onChange(v);
      }}
      className="w-full"
    />
  );
}

/** Multi-select: checkboxes for each option. */
function MultiSelectField({
  id,
  definition,
  value,
  onChange,
}: {
  id: string;
  definition: PreferenceDefinition;
  value: unknown;
  onChange: (v: string[]) => void;
}) {
  const selected = Array.isArray(value) ? (value as string[]) : [];
  const options = definition.options ?? [];

  const toggle = (optValue: string) => {
    if (selected.includes(optValue)) {
      onChange(selected.filter((v) => v !== optValue));
    } else {
      onChange([...selected, optValue]);
    }
  };

  return (
    <div id={id} className="space-y-2" role="group" aria-label={definition.label}>
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex items-center gap-2 cursor-pointer text-sm"
        >
          <input
            type="checkbox"
            checked={selected.includes(opt.value)}
            onChange={() => toggle(opt.value)}
            className="rounded border-gray-300 text-navActiveIcon focus:ring-navActiveIcon"
          />
          <span>{opt.label}</span>
        </label>
      ))}
      {options.length === 0 && (
        <p className="text-sm text-gray-500">
          {definition.placeholder ?? "Options will be loaded from API."}
        </p>
      )}
    </div>
  );
}

/** Single-select dropdown. */
function SingleSelectField({
  id,
  definition,
  value,
  onChange,
}: {
  id: string;
  definition: PreferenceDefinition;
  value: unknown;
  onChange: (v: string) => void;
}) {
  const str = typeof value === "string" ? value : "";
  const options = definition.options ?? [];
  return (
    <Select
      id={id}
      options={options}
      placeholder={definition.placeholder ?? `Select ${definition.label}`}
      value={str}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function PreferenceField({
  definition,
  value,
  onChange,
}: PreferenceFieldProps) {
  const id = useId();
  const baseId = `pref-${definition.key}-${id.replace(/:/g, "")}`;

  const handleChange = (v: unknown) => onChange(definition.key, v);

  return (
    <div className="p-4 bg-card rounded-card border border-gray-200">
      <label
        htmlFor={baseId}
        className="block text-sm font-medium text-gray-900 mb-2"
      >
        {definition.label}
        {definition.optional && (
          <span className="text-gray-500 font-normal ml-1">(optional)</span>
        )}
      </label>
      {definition.description && (
        <p className="text-sm text-gray-500 mb-2">{definition.description}</p>
      )}
      {definition.inputType === "keyword" && (
        <KeywordField
          id={baseId}
          definition={definition}
          value={value}
          onChange={(v) => handleChange(v)}
        />
      )}
      {definition.inputType === "date-range" && (
        <DateRangeField
          id={baseId}
          value={value}
          onChange={(v) => handleChange(v)}
        />
      )}
      {definition.inputType === "number-range" && (
        <NumberRangeField
          id={baseId}
          definition={definition}
          value={value}
          onChange={(v) => handleChange(v)}
        />
      )}
      {definition.inputType === "number" && (
        <NumberField
          id={baseId}
          definition={definition}
          value={value}
          onChange={(v) => handleChange(v)}
        />
      )}
      {definition.inputType === "multi-select" && (
        <MultiSelectField
          id={baseId}
          definition={definition}
          value={value}
          onChange={(v) => handleChange(v)}
        />
      )}
      {definition.inputType === "single-select" && (
        <SingleSelectField
          id={baseId}
          definition={definition}
          value={value}
          onChange={(v) => handleChange(v)}
        />
      )}
    </div>
  );
}
