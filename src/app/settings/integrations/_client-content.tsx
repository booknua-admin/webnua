import { IntegrationCard } from '@/components/shared/settings/IntegrationCard';
import { IntegrationProgressHero } from '@/components/shared/settings/IntegrationProgressHero';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { clientSettingsNav } from '@/lib/nav/client-settings-nav';
import { clientIntegrations, clientIntegrationsHero } from '@/lib/settings/client-integrations';

export function ClientIntegrationsContent() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Integrations" />} />
      <SettingsShell
        eyebrow="Voltline · your account"
        title={
          <>
            Your <em>integrations</em>.
          </>
        }
        subtitle={
          <>
            Connect your business accounts so Webnua can manage reviews, ads, and payments on your
            behalf. <strong>Setup takes about 5 minutes</strong> — Craig walks you through it if you
            get stuck.
          </>
        }
        items={clientSettingsNav}
      >
        <IntegrationProgressHero
          tag={clientIntegrationsHero.tag}
          title={clientIntegrationsHero.title}
          subtitle={clientIntegrationsHero.subtitle}
          connected={clientIntegrationsHero.connected}
          total={clientIntegrationsHero.total}
          remainingLabel={clientIntegrationsHero.remaining}
        />

        <div className="flex flex-col gap-3">
          {clientIntegrations.map((item) => (
            <IntegrationCard
              key={item.id}
              name={item.name}
              description={item.description}
              status={item.status}
              statusLabel={item.statusLabel}
              logo={item.logo}
              meta={item.meta}
              action={item.action}
            />
          ))}
        </div>

        <div className="mt-6 flex items-start gap-3.5 rounded-xl bg-paper-2 px-[22px] py-[18px]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-base text-paper">
            ?
          </div>
          <div className="text-[13px] leading-[1.55] text-ink/70 [&_strong]:text-ink">
            <strong>Stuck on a connection?</strong> Most integrations take 30 seconds. If something
            asks for permissions you don&apos;t recognise, that&apos;s normal — Webnua only requests
            what&apos;s needed to manage your account. Submit a ticket and Craig will walk you
            through it on a quick call.
          </div>
        </div>
      </SettingsShell>
    </>
  );
}
