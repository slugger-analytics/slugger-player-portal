// PURPOSE: Single item in the Updates feed: avatar, text, relative timestamp.
// Used on /dashboard/alerts. Timestamps should use normalized timezone (Mexico Delay) for display.
import { GripVertical } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

export interface UpdateCardProps {
  id: string;
  /** Main text (e.g. "News Update info info info info") */
  text: string;
  /** Relative time string (e.g. "1 min ago", "3 hours ago") — TODO: format via formatters.ts */
  relativeTime: string;
  /** Optional image URL for the update (e.g. player headshot) */
  imageUrl?: string | null;
}

export function UpdateCard({
  id,
  text,
  relativeTime,
  imageUrl,
}: UpdateCardProps) {
  return (
    <article
      className="flex items-center gap-4 p-4 bg-card rounded-card border border-gray-200"
      data-testid="update-card"
      data-id={id}
    >
      <button
        type="button"
        className="p-1 rounded text-gray-400 hover:text-gray-600 cursor-grab"
        aria-label="Reorder"
      >
        <GripVertical className="w-5 h-5" />
      </button>
      <Avatar src={imageUrl} alt="" size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 truncate">{text}</p>
      </div>
      <time
        className="text-xs text-gray-500 shrink-0"
        dateTime={relativeTime}
      >
        {relativeTime}
      </time>
    </article>
  );
}
