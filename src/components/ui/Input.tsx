// PURPOSE: Reusable input primitive for forms.
import { type InputHTMLAttributes } from "react";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}
