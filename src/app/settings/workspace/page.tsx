import Link from 'next/link';

import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';

// Agency workspace identity + plan + usage. The previous page rendered
// hardcoded stubs ("Webnua / ws_perth_8f4e2a1c / Australia/Perth / AUD ($)
// / Operator · 4 clients / ~$135 / month") that misled operators about
// what was actually wired. With Webnua as the single agency workspace in
// V1, there's nothing real to render here — the multi-workspace surface
// becomes meaningful when the agency plan launches.

export default function AdminSettingsWorkspacePage() {
  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Workspace" />}
      />
      <SettingsShell
        eyebrow="Agency · Webnua"
        title={
          <>
            Workspace <em>settings</em>.
          </>
        }
        subtitle={
          <>
            <strong>This surface comes online when you launch the agency
            plan.</strong> Workspace identity, plan tier, and platform usage
            will live here once multiple agency workspaces exist. For now
            there&apos;s only one workspace (yours).
          </>
        }
      >
        <SettingsPanel>
          <SettingsSection
            heading={
              <>
                Coming <em>soon</em>
              </>
            }
            description="Until then, the workspace label + identity is hardcoded as 'Webnua'."
          >
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild>
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
            </div>
          </SettingsSection>
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}
