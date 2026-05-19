'use client';

// =============================================================================
// ContactGateStep — the lead capture. The prospect has watched their guarantee
// climb; the personalised result + reveal sit behind name/email/phone. By now
// they're trading contact details to KEEP what's already theirs, not gambling
// on strangers.
//
// Exit-intent: a prospect leaving before submitting gets one email-only catch
// so a bounce still becomes a lead.
// =============================================================================

import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Input } from '@/components/ui/input';
import type { GuaranteeEstimate } from '@/lib/signup/guarantee';
import type { ContactDetails } from '@/lib/signup/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ContactGateStepProps = {
  estimate: GuaranteeEstimate;
  onSubmit: (contact: ContactDetails) => Promise<{ ok: boolean; error?: string }>;
  onExitCapture: (email: string) => Promise<void>;
  onBack: () => void;
};

function ContactGateStep({
  estimate,
  onSubmit,
  onExitCapture,
  onBack,
}: ContactGateStepProps) {
  const [contact, setContact] = useState<ContactDetails>({
    name: '',
    email: '',
    phone: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showExit, setShowExit] = useState(false);
  const [exitEmail, setExitEmail] = useState('');
  const [exitDone, setExitDone] = useState(false);
  // Honeypot — bots fill hidden fields; humans never see this.
  const [honeypot, setHoneypot] = useState('');
  const settledRef = useRef(false);

  const ready =
    contact.name.trim().length > 1 &&
    EMAIL_RE.test(contact.email.trim()) &&
    contact.phone.trim().length > 4;

  // Exit-intent: pointer leaving past the top edge, once, before submitting.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (e.clientY > 0 || settledRef.current) return;
      settledRef.current = true;
      setShowExit(true);
    };
    document.addEventListener('mouseout', handler);
    return () => document.removeEventListener('mouseout', handler);
  }, []);

  const handleSubmit = async () => {
    if (!ready || submitting) return;
    if (honeypot) return; // bot
    settledRef.current = true;
    setSubmitting(true);
    setError(null);
    const result = await onSubmit({
      name: contact.name.trim(),
      email: contact.email.trim(),
      phone: contact.phone.trim(),
    });
    if (!result.ok) {
      setError(
        result.error === 'rate_limited'
          ? 'Too many attempts — give it a minute and try again.'
          : 'Something went wrong. Please try again.',
      );
      setSubmitting(false);
    }
    // On success the parent advances the flow.
  };

  const handleExitCapture = async () => {
    if (!EMAIL_RE.test(exitEmail.trim())) return;
    await onExitCapture(exitEmail.trim());
    setExitDone(true);
  };

  return (
    <div className="mx-auto w-full max-w-[560px]">
      <div className="mb-6 text-center">
        <Eyebrow tone="rust">{'// Your results are ready'}</Eyebrow>
        <h2 className="mt-3 text-[32px] leading-[1.1] font-extrabold tracking-[-0.03em] text-ink">
          We&apos;ve locked in a guarantee of{' '}
          <span className="text-rust">
            {estimate.leads} qualified leads a month
          </span>{' '}
          for you.
        </h2>
        <p className="mt-3 text-[15px] leading-[1.55] text-ink-quiet">
          Where should we send your results and the system we built? We&apos;ll
          show it to you on the next screen.
        </p>
      </div>

      <div className="rounded-2xl border border-rule bg-card px-7 py-7">
        <div className="flex flex-col gap-4">
          <Field id="gate-name" label="Your name">
            <Input
              id="gate-name"
              autoComplete="name"
              placeholder="Jordan Lee"
              value={contact.name}
              onChange={(e) =>
                setContact((c) => ({ ...c, name: e.target.value }))
              }
            />
          </Field>
          <Field id="gate-email" label="Email">
            <Input
              id="gate-email"
              type="email"
              autoComplete="email"
              placeholder="you@yourbusiness.com"
              value={contact.email}
              onChange={(e) =>
                setContact((c) => ({ ...c, email: e.target.value }))
              }
            />
          </Field>
          <Field id="gate-phone" label="Phone">
            <Input
              id="gate-phone"
              type="tel"
              autoComplete="tel"
              placeholder="+353 …"
              value={contact.phone}
              onChange={(e) =>
                setContact((c) => ({ ...c, phone: e.target.value }))
              }
            />
          </Field>

          {/* Honeypot — visually hidden, off the tab order. */}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            className="absolute h-0 w-0 overflow-hidden opacity-0"
          />

          {error && (
            <p
              role="alert"
              className="rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn"
            >
              {error}
            </p>
          )}

          <Button
            size="lg"
            className="w-full"
            disabled={!ready || submitting}
            onClick={handleSubmit}
          >
            {submitting ? 'Getting your results…' : 'Get my results →'}
          </Button>
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet/70">
            No spam · we&apos;ll only contact you about your lead system
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="mx-auto mt-5 block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet hover:text-rust"
      >
        ← Back
      </button>

      {showExit && !submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 px-6">
          <div className="w-full max-w-[420px] rounded-2xl border border-rule bg-card px-7 py-7">
            {exitDone ? (
              <>
                <Eyebrow tone="rust">{'// Sent'}</Eyebrow>
                <p className="mt-3 text-[19px] font-extrabold tracking-[-0.02em] text-ink">
                  Your results are on the way.
                </p>
                <p className="mt-2 text-[14px] leading-[1.5] text-ink-quiet">
                  Check your inbox. Or finish now and see your lead system
                  live.
                </p>
                <Button
                  className="mt-5 w-full"
                  onClick={() => setShowExit(false)}
                >
                  Finish &amp; see it live →
                </Button>
              </>
            ) : (
              <>
                <Eyebrow tone="rust">{'// Before you go'}</Eyebrow>
                <p className="mt-3 text-[19px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">
                  Want your {estimate.leads}-lead guarantee emailed to you?
                </p>
                <p className="mt-2 text-[14px] leading-[1.5] text-ink-quiet">
                  Drop your email and we&apos;ll send your results — no need to
                  finish now.
                </p>
                <Input
                  className="mt-4"
                  type="email"
                  placeholder="you@yourbusiness.com"
                  value={exitEmail}
                  onChange={(e) => setExitEmail(e.target.value)}
                />
                <Button
                  className="mt-3 w-full"
                  disabled={!EMAIL_RE.test(exitEmail.trim())}
                  onClick={handleExitCapture}
                >
                  Email me my results →
                </Button>
                <button
                  type="button"
                  onClick={() => setShowExit(false)}
                  className="mx-auto mt-3 block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet hover:text-rust"
                >
                  No thanks, I&apos;ll finish now
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export { ContactGateStep };
