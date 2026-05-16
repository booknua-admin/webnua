import { ApiKeyRow } from '@/components/shared/settings/ApiKeyRow';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { WebhookEventRow } from '@/components/shared/settings/WebhookEventRow';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { adminApiKeys, adminWebhookEndpoint, adminWebhookEvents } from '@/lib/settings/admin-api';

export default function AdminSettingsApiPage() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="API + webhooks" />} />
      <SettingsShell
        eyebrow="Workspace · Webnua Perth"
        title={
          <>
            Settings + <em>integrations</em>.
          </>
        }
        subtitle={
          <>
            API keys and webhook endpoints for advanced integrations.{' '}
            <strong>Most operators won&apos;t need this</strong> — only used if you&apos;re piping
            data into third-party CRMs or building custom workflows.
          </>
        }
      >
        <SettingsPanel>
          <SettingsSection
            heading={
              <>
                API <em>keys</em>
              </>
            }
            description={
              <>
                Used to authenticate API requests to Webnua.{' '}
                <strong>Keep secret — anyone with the key can read your workspace data.</strong>
              </>
            }
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
                <strong className="text-ink">2</strong> active keys
              </span>
              <Button size="sm">+ Generate new key</Button>
            </div>
            {adminApiKeys.map((key) => (
              <ApiKeyRow
                key={key.id}
                name={key.name}
                token={key.token}
                createdLabel={key.createdLabel}
                usedLabel={key.usedLabel}
              />
            ))}
          </SettingsSection>

          <SettingsSection
            heading={
              <>
                Webhook <em>endpoints</em>
              </>
            }
            description="Webnua POSTs to these URLs when events happen in your workspace. Used for piping leads into other systems."
          >
            <div className="grid grid-cols-[1fr_90px_100px_80px] items-center gap-3.5 rounded-lg border border-rule bg-paper px-[18px] py-3.5">
              <div>
                <div className="mb-1 text-[13px] font-bold text-ink">
                  {adminWebhookEndpoint.name}
                </div>
                <div className="font-mono text-[11px] tracking-[0.04em] text-ink-quiet">
                  {adminWebhookEndpoint.url}
                </div>
              </div>
              <div className="font-mono text-[10px] tracking-[0.04em] text-ink-quiet">
                <strong className="font-semibold text-ink">
                  {adminWebhookEndpoint.eventCount}
                </strong>{' '}
                events
              </div>
              <div className="font-mono text-[10px] tracking-[0.04em] text-ink-quiet">
                {adminWebhookEndpoint.scope}
              </div>
              <span className="cursor-pointer text-right font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-rust">
                Edit
              </span>
            </div>
          </SettingsSection>

          <SettingsSection
            heading={
              <>
                Recent webhook <em>events</em>
              </>
            }
            description="Last 8 webhook deliveries · 100% success rate over 7 days."
          >
            <div className="mt-3 flex flex-col gap-1.5">
              {adminWebhookEvents.map((event) => (
                <WebhookEventRow
                  key={event.id}
                  time={event.time}
                  event={event.event}
                  status={event.status}
                />
              ))}
            </div>
          </SettingsSection>
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}
