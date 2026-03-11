// PURPOSE: Card displaying a player summary for the recruitment dashboard feed.
// Shows avatar, primary info line, secondary info. Used in Player Discovery list and elsewhere.
import { Avatar } from "@/components/ui/Avatar";
import { AvailabilityBadge } from "./AvailabilityBadge";

export interface PlayerCardProps {
  /** Player display name */
  name?: string;
  /** Optional headshot URL */
  imageUrl?: string | null;
  /** Primary line (e.g. position, team) */
  primaryInfo?: string;
  /** Secondary line (e.g. stats or status) */
  secondaryInfo?: string;
  /** Availability status for badge — TODO: type from types/player */
  availabilityStatus?: string;
}

export function PlayerCard({
  name = "Player",
  imageUrl,
  primaryInfo,
  secondaryInfo,
  availabilityStatus,
}: PlayerCardProps) {
  return (
    <article
      className="flex items-center gap-4 p-4 bg-white rounded-card border border-gray-200 hover:border-gray-300 transition-colors"
      data-testid="player-card"
    >
      <Avatar src={imageUrl} alt={name} size="md" fallback={name.slice(0, 1)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
        {primaryInfo && (
          <p className="text-sm text-gray-600 truncate">{primaryInfo}</p>
        )}
        {secondaryInfo && (
          <p className="text-xs text-gray-500 truncate">{secondaryInfo}</p>
        )}
      </div>
      {availabilityStatus && (
        <AvailabilityBadge status={availabilityStatus} />
      )}
    </article>
  );
}
