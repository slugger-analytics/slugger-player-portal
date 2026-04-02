"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, GripVertical } from "lucide-react";

export const PREFERENCE_OPTIONS = [
  { id: "transaction-dates", label: "Transaction date(s)", inputType: "date" as const, placeholder: "Select date" },
  { id: "transaction-type", label: "Transaction type", inputType: "text" as const, placeholder: "e.g. Waived, Released" },
  { id: "transaction-description", label: "Transaction description (keyword search)", inputType: "text" as const, placeholder: "Keyword search" },
  { id: "player-name", label: "Player name", inputType: "text" as const, placeholder: "Player name" },
  { id: "mlb-teams", label: "MLB team(s)", inputType: "text" as const, placeholder: "e.g. Yankees, Red Sox" },
  { id: "minor-league-teams", label: "Minor League team(s)", inputType: "text" as const, placeholder: "Minor league team(s)" },
  { id: "batting-throwing", label: "Batting/throwing (averages & range)", inputType: "text" as const, placeholder: "e.g. .250 avg or min–max" },
  { id: "position", label: "Position", inputType: "text" as const, placeholder: "e.g. OF, RHP, SS" },
  { id: "current-status", label: "Current status", inputType: "text" as const, placeholder: "e.g. injured, active, retired" },
  { id: "years-active", label: "Years active", inputType: "number" as const, placeholder: "e.g. 5" },
  { id: "current-age", label: "Current age", inputType: "number" as const, placeholder: "e.g. 28" },
  { id: "highest-level", label: "Highest level reached", inputType: "text" as const, placeholder: "e.g. MLB, AAA" },
] as const;

export type PreferenceId = (typeof PREFERENCE_OPTIONS)[number]["id"];

export type PreferenceValues = Partial<Record<PreferenceId, string>>;

export function PreferencesDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<Set<PreferenceId>>(new Set());
  const [values, setValues] = useState<PreferenceValues>({});
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggle = (id: PreferenceId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setValues((v) => {
          const nextV = { ...v };
          delete nextV[id];
          return nextV;
        });
      } else next.add(id);
      return next;
    });
  };

  const setValue = (id: PreferenceId, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  };

  const label =
    selected.size === 0
      ? "Add Preferences"
      : `${selected.size} preference${selected.size === 1 ? "" : "s"} selected`;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm lg:col-span-2">
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition-colors hover:bg-slate-100"
        >
          <GripVertical className="h-5 w-5 shrink-0 text-slate-400" />
          <span className="flex-1 text-sm text-slate-600">{label}</span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-[420px] overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-lg">
            <div className="px-2 pt-1">
              {PREFERENCE_OPTIONS.map(({ id, label: optionLabel, inputType, placeholder }) => {
                const isSelected = selected.has(id);
                const value = values[id] ?? "";
                return (
                  <div
                    key={id}
                    className={`rounded-lg px-2 py-2 ${isSelected ? "bg-slate-50" : ""}`}
                  >
                    <label className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(id)}
                        className="h-4 w-4 rounded border-slate-300 text-slate-600 focus:ring-slate-400"
                      />
                      <span className="text-sm text-slate-800">{optionLabel}</span>
                    </label>
                    {isSelected && (
                      <div className="ml-7 mt-2">
                        {inputType === "date" && (
                          <input
                            type="date"
                            value={value}
                            onChange={(e) => setValue(id, e.target.value)}
                            placeholder={placeholder}
                            className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                          />
                        )}
                        {inputType === "number" && (
                          <input
                            type="number"
                            value={value}
                            onChange={(e) => setValue(id, e.target.value)}
                            placeholder={placeholder}
                            min={id === "current-age" ? 16 : 0}
                            max={id === "current-age" ? 50 : undefined}
                            className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                          />
                        )}
                        {inputType === "text" && (
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => setValue(id, e.target.value)}
                            placeholder={placeholder}
                            className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex min-h-[200px] items-center justify-center rounded-xl bg-slate-100">
        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-500"
          aria-label="Add"
        >
          <span className="text-2xl leading-none">+</span>
        </button>
      </div>
    </section>
  );
}
