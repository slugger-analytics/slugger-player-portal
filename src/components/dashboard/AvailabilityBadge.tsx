// PURPOSE: Badge showing availability status (e.g. released, available). Uses Lucide-React.
import { Badge } from "@/components/ui/Badge";

export interface AvailabilityBadgeProps {
  /** Status string to display (e.g. "Available", "Released") — TODO: use AvailabilityStatus type */
  status: string;
}

export function AvailabilityBadge({ status }: AvailabilityBadgeProps) {
  return (
    <Badge className="shrink-0 text-xs font-medium px-2 py-1 rounded-md bg-navActive text-navActiveIcon">
      {status}
    </Badge>
  );
}
