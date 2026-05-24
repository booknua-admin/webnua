import { HelpFaqItem } from '@/components/shared/settings/HelpFaqItem';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { clientHelpFaqs, clientHelpRecentSupport } from '@/lib/settings/client-help';

// Webnua's direct-support contact. Read from public env so deployments can
// override; the displayed number stays human-readable, the tel:/sms: hrefs
// use the E.164 form passed via the env values.
//
// `NEXT_PUBLIC_*` so client-side reads work. Falls back to the same Craig
// number that shipped before — but the env override is the path forward when
// a second operator joins.
const SUPPORT_NAME =
  process.env.NEXT_PUBLIC_SUPPORT_NAME || 'your operator';
const SUPPORT_PHONE_DISPLAY =
  process.env.NEXT_PUBLIC_SUPPORT_PHONE_DISPLAY || '0411 234 567';
const SUPPORT_PHONE_E164 =
  process.env.NEXT_PUBLIC_SUPPORT_PHONE_E164 || '+61411234567';
const SUPPORT_EMAIL_ADDRESS =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@webnua.com';

const SUPPORT_TEL = `tel:${SUPPORT_PHONE_E164}`;
const SUPPORT_SMS = `sms:${SUPPORT_PHONE_E164}`;
const SUPPORT_EMAIL = `mailto:${SUPPORT_EMAIL_ADDRESS}`;

export default function ClientSettingsHelpPage() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Help" />} />
      <SettingsShell
        eyebrow="Your account"
        title={
          <>
            Need <em>help?</em>
          </>
        }
        subtitle={
          <>
            Webnua&apos;s small team handles every support request directly.{' '}
            <strong>No tier-1 chatbots, no tickets that die in a queue.</strong>{' '}
            Text or email below for anything urgent, or browse the questions other
            operators have asked.
          </>
        }
      >
        <SettingsPanel>
          <SettingsSection>
            <div className="grid grid-cols-[1fr_auto] items-center gap-6 rounded-xl bg-ink px-8 py-7 text-paper">
              <div>
                <div className="mb-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust-light">
                  {'// DIRECT LINE'}
                </div>
                <div className="mb-1.5 text-[22px] font-extrabold leading-[1.15] tracking-[-0.025em] [&_em]:not-italic [&_em]:text-rust-light">
                  Text <em>{SUPPORT_NAME}</em> ·{' '}
                  <a href={SUPPORT_TEL} className="underline-offset-2 hover:underline">
                    {SUPPORT_PHONE_DISPLAY}
                  </a>
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
                <Button asChild className="gap-2">
                  <a href={SUPPORT_SMS}>☏ Text now</a>
                </Button>
                <Button
                  asChild
                  variant="secondary"
                  className="gap-2 border-paper/20 bg-paper/[0.08] text-paper hover:bg-paper/[0.12]"
                >
                  <a href={SUPPORT_EMAIL}>✉ Email support</a>
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
            description="Tap to expand. If your question isn't here, text the number above."
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
