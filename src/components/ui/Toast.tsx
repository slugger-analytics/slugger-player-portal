// PURPOSE: Toast notification component; use Lucide-React for icons.
// Styled to match design system (rounded, light background).
export function Toast({
  message,
  variant = "info",
}: {
  message: string;
  variant?: "success" | "error" | "info";
}) {
  const variantClasses = {
    success: "bg-green-50 text-green-800 border-green-200",
    error: "bg-red-50 text-red-800 border-red-200",
    info: "bg-gray-50 text-gray-800 border-gray-200",
  };
  return (
    <div
      role="alert"
      className={`px-4 py-3 rounded-card border ${variantClasses[variant]}`}
    >
      {message}
    </div>
  );
}
