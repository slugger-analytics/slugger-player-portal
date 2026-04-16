// PURPOSE: Layout for Favorites (priority-list) — same AppShell as dashboard for consistent nav.
import { AppShell } from "@/components/layout/AppShell";

export default function PriorityListLayout({
  children,
}: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
