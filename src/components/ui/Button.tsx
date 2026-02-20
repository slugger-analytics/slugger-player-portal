// PURPOSE: Reusable button primitive; use Lucide-React for icons when needed.
import { type ButtonHTMLAttributes } from "react";

export function Button({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props}>{children}</button>;
}
