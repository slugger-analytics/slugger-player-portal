// PURPOSE: Favorites (priority list) — team-specific ranked target lists with drag-and-drop.
// Search bar filters the list by name/subtitle. Data from usePriorityList / API.
import { PriorityListPageClient } from "@/components/priority-list/PriorityListPageClient";

export default function PriorityListPage() {
  return (
    <main className="max-w-3xl mx-auto">
      <PriorityListPageClient />
    </main>
  );
}
