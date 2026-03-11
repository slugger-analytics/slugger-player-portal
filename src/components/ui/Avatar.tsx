// PURPOSE: Circular avatar for player headshots and user placeholders.
// Matches design: circular image or fallback initial/icon.
import { User } from "lucide-react";

export interface AvatarProps {
  /** Image URL for player/user photo. If missing, shows fallback. */
  src?: string | null;
  /** Alt text for the image */
  alt?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Optional fallback initial (e.g. first letter of name) */
  fallback?: string;
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
};

export function Avatar({
  src,
  alt = "",
  size = "md",
  fallback,
  className = "",
}: AvatarProps) {
  const sizeClass = sizeClasses[size];

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`rounded-full object-cover ${sizeClass} ${className}`}
      />
    );
  }

  return (
    <span
      className={`
        rounded-full bg-inputBg flex items-center justify-center text-gray-500
        ${sizeClass} ${className}
      `}
      aria-hidden
    >
      {fallback ? (
        <span className="text-sm font-medium uppercase">{fallback.slice(0, 1)}</span>
      ) : (
        <User className="w-1/2 h-1/2" />
      )}
    </span>
  );
}
