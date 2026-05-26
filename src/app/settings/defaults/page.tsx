import Link from 'next/link';

import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';

// Agency-wide defaults applied to new client onboarding — default branding
// (fonts + accent colour) + default pricing (suggested currency + flat-rate
// buffer). The full editor is V2 work that comes online when the agency plan
// launches; the previous page rendered hardcoded stubs ("Inter Tight" /
// "JetBrains Mono" / "AUD ($)" / "15% buffer") that misled operators about
// what was actually wired.
//
// What IS wired today: `automationDefaults` (the on/off flags for the four
// default automations seeded per new client) — see `lib/agency/agency-
// policy-stub.ts`. That data is consumed by the agency policy resolver, not
// rendered through this surface.
//
// When the V2 editor ships: the "Plan currency" field should source from
// the platform's Stripe Price (via `lib/integrations/stripe/plan-info.ts`)
// rather than carry a hardcoded default — Stripe is the SoT for the
// platform's billing currency.

export default function AdminSettingsDefaultsPage() {
  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Defaults" />}
      />
      <SettingsShell
        eyebrow="Agency · Webnua"
        title={
          <>
            Onboarding <em>defaults</em>.
          </>
        }
        subtitle={
          <>
            <strong>This surface comes online when you launch the agency
            plan.</strong> Default branding (fonts + accent colour) and
            default pricing applied to new client onboarding will live here.
            Default automations are already wired — they apply per new
            client via the agency policy resolver.
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
            description="Edit default automations from inside a sub-account today; default branding + pricing become editable in V2."
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
