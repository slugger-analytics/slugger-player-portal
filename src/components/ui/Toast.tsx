// PURPOSE: Toast notification component; use Lucide-React for icons.
export function Toast({
  message,
  variant,
}: { message: string; variant?: "success" | "error" | "info" }) {
  return <div data-toast>{message}</div>;
}
