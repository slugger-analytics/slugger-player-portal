// PURPOSE: Reusable modal/dialog primitive; use Lucide-React for close icon.
export function Modal({
  children,
  onClose,
}: { children: React.ReactNode; onClose?: () => void }) {
  return <div role="dialog">{children}</div>;
}
