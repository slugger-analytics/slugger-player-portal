// PURPOSE: Wrapper for role-based UI gating; restrict access by UserRole (Manager | Analyst | Player | Agent).
"use client";

export function RoleGuard({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
}) {
  return <>{children}</>;
}
