// PURPOSE: Search input with optional left icon or left content (e.g. dropdown), and right search icon.
// Used for "Add Preferences", "Search Favorites", "Search Updates", "Search Preferences".
import { Search, Menu } from "lucide-react";
import { type InputHTMLAttributes, type ReactNode } from "react";

export interface SearchBarProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  /** Placeholder text (e.g. "Search Favorites", "Add Preferences") */
  placeholder?: string;
  /** Show hamburger icon on the left (for filter/category in design). Ignored if leftContent is set. */
  showLeftIcon?: boolean;
  /** Custom left icon instead of Menu. Ignored if leftContent is set. */
  leftIcon?: ReactNode;
  /** Optional content on the left inside the bar (e.g. integrated dropdown). Replaces left icon when set. */
  leftContent?: ReactNode;
  /** Show search icon on the right. Default true. */
  showSearchIcon?: boolean;
  /** Optional class for the wrapper */
  className?: string;
}

export function SearchBar({
  placeholder = "Search",
  showLeftIcon = true,
  leftIcon,
  leftContent,
  showSearchIcon = true,
  className = "",
  ...inputProps
}: SearchBarProps) {
  const showDefaultLeft = !leftContent && showLeftIcon;

  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-2 bg-inputBg rounded-input
        border border-transparent focus-within:border-gray-300 focus-within:ring-1 focus-within:ring-gray-300
        ${className}
      `}
    >
      {leftContent != null ? leftContent : showDefaultLeft ? (
        <span className="text-gray-500 shrink-0" aria-hidden>
          {leftIcon ?? <Menu className="w-5 h-5" />}
        </span>
      ) : null}
      <input
        type="search"
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm placeholder:text-gray-500"
        aria-label={placeholder}
        {...inputProps}
      />
      {showSearchIcon && (
        <span className="text-gray-500 shrink-0" aria-hidden>
          <Search className="w-5 h-5" />
        </span>
      )}
    </div>
  );
}
