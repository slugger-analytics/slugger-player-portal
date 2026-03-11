// PURPOSE: Reusable input primitive for forms. Accepts className for Tailwind.
import { type InputHTMLAttributes } from "react";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`px-3 py-2 bg-inputBg rounded-input border border-transparent focus:border-gray-300 focus:ring-1 focus:ring-gray-300 outline-none text-sm ${className}`}
      {...props}
    />
  );
}
