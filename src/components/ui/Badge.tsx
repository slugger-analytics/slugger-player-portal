// PURPOSE: Reusable badge for status, rank, or labels; use Lucide-React for icons if needed.
export function Badge({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={className}>{children}</span>;
}
