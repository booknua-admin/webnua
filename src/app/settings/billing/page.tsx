'use client';

import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { SettingsTabPlaceholder } from '@/components/shared/settings/SettingsTabPlaceholder';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { useRole } from '@/lib/auth/role-stub';
import { adminSettingsNav } from '@/lib/nav/admin-settings-nav';
import { clientSettingsNav } from '@/lib/nav/client-settings-nav';

export default function SettingsBillingPage() {
  const { role } = useRole();
  const isAdmin = role === 'admin';

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Billing" />} />
      <SettingsShell
        eyebrow={isAdmin ? 'Workspace · Webnua Perth' : 'Voltline · your account'}
        title={
          isAdmin ? (
            <>
              Settings + <em>integrations</em>.
            </>
          ) : (
            <>
              Your <em>settings</em>.
            </>
          )
        }
        subtitle={
          isAdmin ? (
            <>
              Your plan, payment method, and invoice history.{' '}
              <strong>Webnua Perth is billed monthly in AUD</strong> — base plan plus usage.
            </>
          ) : (
            'Your Webnua plan, payment method, and invoice history. Billed monthly in AUD.'
          )
        }
        items={isAdmin ? adminSettingsNav : clientSettingsNav}
      >
        <SettingsTabPlaceholder tab="Billing" />
      </SettingsShell>
    </>
  );
}
