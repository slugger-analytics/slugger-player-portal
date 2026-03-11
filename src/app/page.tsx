// PURPOSE: Root route redirects to Player Discovery Home (dashboard) so the full app UI
// (sidebar, filters, etc.) is shown by default instead of a bare landing message.
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/dashboard");
}
