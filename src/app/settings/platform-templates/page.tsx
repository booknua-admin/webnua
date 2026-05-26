'use client';

import { PlatformTemplateEditor } from '@/components/shared/settings/PlatformTemplateEditor';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { usePlatformTemplates } from '@/lib/email/platform-templates-queries';
import { normalizeError } from '@/lib/errors';

export default function AdminSettingsPlatformTemplatesPage() {
  const { data, isLoading, error } = usePlatformTemplates();

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Settings']} current="Platform templates" />
        }
      />
      <SettingsShell
        eyebrow="Agency · Webnua"
        title={
          <>
            Platform <em>templates</em>.
          </>
        }
        subtitle={
          <>
            Operator-facing email templates used across every client.{' '}
            <strong>One body fires for all clients</strong> — different from
            the per-client customer-facing templates on each sub-account.
          </>
        }
      >
        <SettingsPanel>
          <SettingsSection
            heading={
              <>
                Operator <em>notifications</em>
              </>
            }
            description={
              <>
                Sent to the operator addresses configured in each client&apos;s
                <code className="mx-1 rounded bg-paper px-1 font-mono text-[12px]">
                  /settings/notifications
                </code>
                . <strong>The body is identical for every client</strong> —
                edits here apply everywhere.
              </>
            }
          >
            {isLoading ? (
              <p className="rounded-md border border-rule bg-paper px-5 py-6 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
                Loading templates…
              </p>
            ) : error ? (
              <p className="rounded-md border border-warn bg-warn-soft px-5 py-6 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-warn">
                {normalizeError(error).message}
              </p>
            ) : (data ?? []).length === 0 ? (
              <p className="rounded-md border border-rule bg-paper px-5 py-6 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
                No platform templates seeded yet — apply migration 0079.
              </p>
            ) : (
              <div className="flex flex-col gap-5">
                {(data ?? []).map((template) => (
                  <PlatformTemplateEditor
                    key={template.templateKey}
                    template={template}
                  />
                ))}
              </div>
            )}
          </SettingsSection>
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}
