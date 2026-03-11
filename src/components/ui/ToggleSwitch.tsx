// PURPOSE: Reusable toggle switch for on/off preferences. Matches Figma: green when on.
// Use in Preferences/settings forms. Lucide not required for the switch itself.
"use client";

import { useId } from "react";

export interface ToggleSwitchProps {
  /** Label shown next to the switch (e.g. "random preference") */
  label: string;
  /** Optional description below the label */
  description?: string;
  /** Controlled checked state */
  checked?: boolean;
  /** Controlled change handler */
  onCheckedChange?: (checked: boolean) => void;
  /** Optional id for the switch (for form labels) */
  id?: string;
}

export function ToggleSwitch({
  label,
  description,
  checked,
  onCheckedChange,
  id: idProp,
}: ToggleSwitchProps) {
  const id = useId();
  const inputId = idProp ?? id;

  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-card rounded-card border border-gray-200">
      <div className="min-w-0">
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-gray-900 block"
        >
          {label}
        </label>
        {description && (
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        id={inputId}
        onClick={() => onCheckedChange?.(!checked)}
        className={`
          relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full
          transition-colors duration-200 ease-in-out
          focus-visible:outline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-navActiveIcon
          ${checked ? "bg-toggleOn" : "bg-gray-300"}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow
            ring-0 transition duration-200 ease-in-out mt-0.5
            ${checked ? "translate-x-5 ml-0.5" : "translate-x-0.5"}
          `}
        />
      </button>
    </div>
  );
}
