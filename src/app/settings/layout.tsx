// PURPOSE: Layout for Settings (Preferences) — same AppShell for consistent nav.
import { AppShell } from "@/components/layout/AppShell";

export default function SettingsLayout({
  children,
}: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
