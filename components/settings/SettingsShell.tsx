/**
 * SettingsShell.tsx
 * Thin server-safe wrapper expected by app/app/settings/page.tsx.
 *
 * The actual settings UI already lives in SettingsClient, which is fully
 * self-contained (it fetches /api/settings itself via react-query and needs
 * no props). This shell just satisfies the import path the page uses and
 * renders it — no new UI or logic, nothing else changed.
 */

import SettingsClient from "@/components/dashboard/settings/SettingsClient";

export function SettingsShell() {
  return <SettingsClient />;
}
