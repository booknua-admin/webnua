import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { SettingsTabPlaceholder } from '@/components/shared/settings/SettingsTabPlaceholder';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { clientSettingsNav } from '@/lib/nav/client-settings-nav';

export default function ClientSettingsHelpPage() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Help" />} />
      <SettingsShell
        eyebrow="Voltline · your account"
        title={
          <>
            Your <em>settings</em>.
          </>
        }
        subtitle={
          <>
            Need help? Webnua&apos;s two-person team (Craig + Raj) handles every support request
            directly. <strong>No tier-1 chatbots, no tickets that die in a queue.</strong>
          </>
        }
        items={clientSettingsNav}
      >
        <SettingsTabPlaceholder tab="Help" />
      </SettingsShell>
    </>
  );
}
