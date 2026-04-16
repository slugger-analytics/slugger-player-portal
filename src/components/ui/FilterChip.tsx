// PURPOSE: Filter or preference chip/card as in Player Discovery: "Position: Pitcher", "Age: Less than 25".
// Shows label, optional keyboard shortcut (e.g. ⌘C), and menu (⋮) for edit/remove.
import { User, MoreVertical } from "lucide-react";

export interface FilterChipProps {
  /** Primary label (e.g. "Position: Pitcher", "Age: Less than 25") */
  label: string;
  /** Optional keyboard shortcut hint */
  shortcut?: string;
  /** Called when the menu (⋮) is clicked — TODO: replace with dropdown */
  onMenuClick?: () => void;
  /** Optional icon on the left (default: User per design) */
  icon?: React.ReactNode;
}

export function FilterChip({
  label,
  shortcut,
  onMenuClick,
  icon,
}: FilterChipProps) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 bg-card rounded-card border border-gray-200"
      role="group"
    >
      <span className="text-gray-500 shrink-0" aria-hidden>
        {icon ?? <User className="w-5 h-5" />}
      </span>
      <span className="flex-1 min-w-0 text-sm font-medium text-gray-900 truncate">
        {label}
      </span>
      {shortcut && (
        <kbd className="hidden sm:inline text-xs text-gray-500 font-mono">
          {shortcut}
        </kbd>
      )}
      <button
        type="button"
        onClick={onMenuClick}
        className="p-1 rounded hover:bg-gray-200 text-gray-500"
        aria-label="More options"
      >
        <MoreVertical className="w-5 h-5" />
      </button>
    </div>
  );
}
