// PURPOSE: Updates page — triggered player availability alerts and transaction feed.
// Search bar filters the list by update text. Data from API; timestamps normalized (Mexico Delay).
import { AlertsPageClient } from "@/components/dashboard/AlertsPageClient";

export default function AlertsPage() {
  return (
    <main className="max-w-3xl mx-auto">
      <AlertsPageClient />
    </main>
  );
}
