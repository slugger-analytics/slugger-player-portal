// PURPOSE: Updates feed — list of UpdateCard items (alerts/transactions).
// Can be Server Component with initial data; real-time via polling/WebSocket later (useAlerts).
import { UpdateCard } from "./UpdateCard";

export interface TransactionFeedItem {
  id: string;
  text: string;
  relativeTime: string;
  imageUrl?: string | null;
}

export interface TransactionFeedProps {
  items: TransactionFeedItem[];
}

export function TransactionFeed({ items }: TransactionFeedProps) {
  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-500 rounded-card bg-card border border-gray-200">
        No updates yet. New player availability and transactions will appear here.
      </div>
    );
  }

  return (
    <ul className="space-y-2" role="list" aria-label="Updates feed">
      {items.map((item) => (
        <li key={item.id}>
          <UpdateCard
            id={item.id}
            text={item.text}
            relativeTime={item.relativeTime}
            imageUrl={item.imageUrl}
          />
        </li>
      ))}
    </ul>
  );
}
