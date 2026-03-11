// PURPOSE: Reusable textarea for multi-line input (e.g. Preferences "Description" field).
import { type TextareaHTMLAttributes } from "react";

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className="w-full px-3 py-2 bg-inputBg rounded-input border border-transparent focus:border-gray-300 focus:ring-1 focus:ring-gray-300 outline-none text-sm placeholder:text-gray-500 min-h-[80px]"
      {...props}
    />
  );
}
