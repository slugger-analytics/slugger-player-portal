// PURPOSE: Modal to add a single data preference from the dashboard FilterBar.
// User selects a preference type, sets value, then adds a chip (structured for API).
"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { PREFERENCE_DEFINITIONS, getPreferenceDefinition } from "@/lib/preference-definitions";
import { PreferenceField } from "@/components/notifications/PreferenceField";
import { formatPreferenceLabel } from "@/lib/preference-labels";
import type { PreferenceKey } from "@/types/preferences";

export interface AddedPreference {
  key: PreferenceKey;
  label: string;
  value: unknown;
}

export interface AddPreferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (preference: AddedPreference) => void;
  /** When set, modal opens directly to this preference type (e.g. from search bar dropdown). */
  initialPreferenceKey?: PreferenceKey | null;
}

export function AddPreferenceModal({
  isOpen,
  onClose,
  onAdd,
  initialPreferenceKey = null,
}: AddPreferenceModalProps) {
  const [selectedKey, setSelectedKey] = useState<PreferenceKey | null>(null);
  const [value, setValue] = useState<unknown>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedKey(initialPreferenceKey ?? null);
      setValue(null);
    }
  }, [isOpen, initialPreferenceKey]);

  const definition = selectedKey ? getPreferenceDefinition(selectedKey) : null;

  const handleAdd = () => {
    if (!selectedKey || !definition) return;
    const label = formatPreferenceLabel(selectedKey, value);
    onAdd({ key: selectedKey, label, value });
    setSelectedKey(null);
    setValue(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-pref-title"
    >
      <div className="bg-white rounded-card shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 id="add-pref-title" className="text-lg font-semibold text-gray-900">
            {selectedKey ? definition?.label ?? "Add preference" : "Add preference"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {!selectedKey ? (
            <>
              <p className="text-sm text-gray-500">
                Choose a filter type to add to your discovery.
              </p>
              <ul className="space-y-1">
                {PREFERENCE_DEFINITIONS.map((def) => (
                  <li key={def.key}>
                    <button
                      type="button"
                      onClick={() => setSelectedKey(def.key)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 text-sm font-medium text-gray-900"
                    >
                      {def.label}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              {definition && (
                <PreferenceField
                  definition={definition}
                  value={value}
                  onChange={(k, v) => setValue(v)}
                />
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedKey(null);
                    setValue(null);
                  }}
                  className="px-3 py-2 rounded-input border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  className="px-3 py-2 rounded-input bg-navActiveIcon text-white text-sm font-medium hover:opacity-90"
                >
                  Add filter
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
