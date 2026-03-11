// PURPOSE: Layout for Manager/Coach dashboard; wrap with RoleGuard for Manager role.
// Uses shared AppShell (sidebar + top bar) for consistent chrome.
import { AppShell } from "@/components/layout/AppShell";

export default function DashboardLayout({
  children,
}: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
