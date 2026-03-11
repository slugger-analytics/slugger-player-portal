// PURPOSE: Preferences page — UI for Managers to configure notification/alert rules.
// NotificationSettingsForm includes Search Preferences bar and filtered form.
import { NotificationSettingsForm } from "@/components/notifications/NotificationSettingsForm";

export default function NotificationSettingsPage() {
  return (
    <main className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Preferences</h1>
      <NotificationSettingsForm />
    </main>
  );
}
