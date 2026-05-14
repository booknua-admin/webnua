import { HelpFaqItem } from '@/components/shared/settings/HelpFaqItem';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { clientSettingsNav } from '@/lib/nav/client-settings-nav';
import { clientHelpFaqs, clientHelpRecentSupport } from '@/lib/settings/client-help';

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
        <SettingsPanel>
          <SettingsSection>
            <div className="grid grid-cols-[1fr_auto] items-center gap-6 rounded-xl bg-ink px-8 py-7 text-paper">
              <div>
                <div className="mb-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust-light">
                  {'// DIRECT LINE'}
                </div>
                <div className="mb-1.5 text-[22px] font-extrabold leading-[1.15] tracking-[-0.025em] [&_em]:not-italic [&_em]:text-rust-light">
                  Text <em>Craig</em> · 0411 234 567
                </div>
                <p className="max-w-[480px] text-[13px] leading-[1.5] text-paper/70 [&_strong]:font-semibold [&_strong]:text-paper">
                  For anything urgent — a lead going cold, a customer complaint, an automation
                  message that needs to stop.{' '}
                  <strong>
                    Typical reply: 12 minutes during business hours, by 8am next day otherwise.
                  </strong>
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button className="gap-2">☏ Text now</Button>
                <Button
                  variant="secondary"
                  className="gap-2 border-paper/20 bg-paper/[0.08] text-paper hover:bg-paper/[0.12]"
                >
                  ✉ Email Craig
                </Button>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            heading={
              <>
                Common <em>questions</em>
              </>
            }
            description="Tap to expand. If your question isn't here, text Craig."
          >
            <div className="overflow-hidden rounded-lg border border-rule bg-paper">
              {clientHelpFaqs.map((faq) => (
                <HelpFaqItem
                  key={faq.id}
                  question={faq.question}
                  answer={faq.answer}
                  defaultOpen={faq.defaultOpen}
                />
              ))}
            </div>
          </SettingsSection>

          <SettingsSection
            heading={
              <>
                Recent <em>support</em>
              </>
            }
            description="Your conversations with the Webnua team."
          >
            <div className="flex flex-col gap-2">
              {clientHelpRecentSupport.map((conv) => (
                <div
                  key={conv.id}
                  className="rounded-lg border border-rule bg-paper px-[18px] py-3.5"
                >
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-[13px] font-bold text-ink">{conv.title}</span>
                    <span className="font-mono text-[10px] tracking-[0.06em] text-ink-quiet">
                      {conv.when}
                    </span>
                  </div>
                  <div className="text-[12px] leading-[1.4] text-ink-quiet">{conv.summary}</div>
                </div>
              ))}
            </div>
          </SettingsSection>
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}
