// PURPOSE: Layout for History — same AppShell for consistent nav.
import { AppShell } from "@/components/layout/AppShell";

export default function HistoryLayout({
  children,
}: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
