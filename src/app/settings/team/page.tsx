'use client';

// /settings/team — shared-slug tab. Both roles reach a "Team" tab from their
// own nav, so the page dispatches on role (same pattern as /settings/
// integrations). Operator → workspace team management; client → their own
// client account's teammates.

import { useRole } from '@/lib/auth/user-stub';

import { AdminSettingsTeamContent } from './_admin-content';
import { ClientSettingsTeamContent } from './_client-content';

export default function SettingsTeamPage() {
  const { role } = useRole();
  if (role === 'admin') return <AdminSettingsTeamContent />;
  return <ClientSettingsTeamContent />;
}
