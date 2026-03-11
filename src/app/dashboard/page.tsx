// PURPOSE: Main real-time recruitment feed for Managers and Coaches (Player Discovery Home).
// Renders page title and DashboardContent (FilterBar + player list). Data fetching in Server Components.
import { DashboardContent } from "@/components/dashboard/DashboardContent";

// TODO: Fetch initial filters (e.g. saved user prefs) and player list from DB/API.
// For now pass mock data so the UI matches Figma; replace with server data.
const MOCK_INITIAL_FILTERS = [
  { id: "1", label: "Position: Pitcher" },
  { id: "2", label: "Age: Less than 25" },
];

export default function DashboardPage() {
  return (
    <main className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Player Discovery Home
      </h1>
      <DashboardContent initialFilters={MOCK_INITIAL_FILTERS} />
    </main>
  );
}
