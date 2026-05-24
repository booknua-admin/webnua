// =============================================================================
// /invite/[token] — public invite acceptance page.
//
// Server-renders the invite metadata (workspace name, inviter, expiry,
// optional note) via the resolver, then renders the password-set form
// (a 'use client' component) so the customer can complete acceptance.
//
// State branches:
//   - valid invite     → renders the form
//   - not_found        → 404-style message
//   - expired/revoked  → friendly explainer + "contact your operator" link
//   - consumed         → friendly explainer + "sign in" CTA (already accepted)
// =============================================================================

import Link from 'next/link';

import { BrandMark } from '@/components/ui/BrandMark';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { resolveInviteByToken } from '@/lib/invites/server';

import { AcceptInviteForm } from './_form';

type Params = { token: string };

export const dynamic = 'force-dynamic';

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { token } = await params;
  const result = await resolveInviteByToken(token);

  if (!result.ok) {
    return <InviteErrorState reason={result.reason} />;
  }

  const workspaceName =
    result.kind === 'client' ? result.clientName : result.workspaceName;
  const subtitle =
    result.kind === 'client'
      ? `into ${result.clientName}`
      : `to ${result.workspaceName}${result.roleLabel ? ` as ${result.roleLabel}` : ''}`;

  return (
    <div className="flex w-full max-w-md flex-col items-stretch gap-8">
      <div className="flex flex-col items-center gap-3 text-ink">
        <BrandMark size="lg" />
        <Eyebrow tone="quiet">{'// You’re invited'}</Eyebrow>
      </div>

      <Card className="gap-7 py-8">
        <CardHeader className="gap-2">
          <Eyebrow tone="rust">
            {'// '}
            {result.inviterName} invited you {subtitle}
          </Eyebrow>
          <CardTitle className="text-[28px] leading-[1.1] font-extrabold tracking-[-0.03em] text-ink">
            Welcome to <span className="text-rust">{workspaceName}</span>.
          </CardTitle>
          <CardDescription className="text-sm text-ink-quiet">
            Set a password to finish setting up your account. You&apos;ll land
            on your dashboard right after.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {result.personalNote ? (
            <div className="mb-6 rounded-md border-l-[3px] border-rust bg-paper px-4 py-3">
              <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
                Note from {result.inviterName}
              </div>
              <p className="whitespace-pre-line text-[13px] italic leading-relaxed text-ink-soft">
                {result.personalNote}
              </p>
            </div>
          ) : null}

          <AcceptInviteForm
            token={token}
            defaultFullName={result.fullName}
            workspaceName={workspaceName}
          />
        </CardContent>
      </Card>

      <p className="text-center font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-ink-quiet/70">
        &copy; Webnua &middot; Perth
      </p>
    </div>
  );
}

function InviteErrorState({
  reason,
}: {
  reason: 'not_found' | 'expired' | 'consumed' | 'revoked';
}) {
  const meta = REASON_META[reason];
  return (
    <div className="flex w-full max-w-md flex-col items-stretch gap-8">
      <div className="flex flex-col items-center gap-3 text-ink">
        <BrandMark size="lg" />
        <Eyebrow tone="quiet">{'// Invite link'}</Eyebrow>
      </div>

      <Card className="gap-7 py-8">
        <CardHeader className="gap-2">
          <Eyebrow tone={reason === 'consumed' ? 'rust' : 'quiet'}>{meta.eyebrow}</Eyebrow>
          <CardTitle className="text-[24px] leading-[1.1] font-extrabold tracking-[-0.025em] text-ink">
            {meta.title}
          </CardTitle>
          <CardDescription className="text-sm text-ink-quiet">{meta.description}</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col gap-3 text-sm text-ink-soft">
            {meta.action === 'sign-in' ? (
              <Link
                href="/login"
                className="inline-flex h-10 items-center justify-center rounded-md bg-rust px-5 font-bold text-paper hover:bg-rust-deep"
              >
                Sign in →
              </Link>
            ) : (
              <p>
                Contact the person who invited you to send a new link, or
                reach Webnua support at{' '}
                <a href="mailto:support@webnua.com" className="font-semibold text-rust">
                  support@webnua.com
                </a>
                .
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="text-center font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-ink-quiet/70">
        &copy; Webnua &middot; Perth
      </p>
    </div>
  );
}

const REASON_META: Record<
  'not_found' | 'expired' | 'consumed' | 'revoked',
  {
    eyebrow: string;
    title: string;
    description: string;
    action: 'request-new' | 'sign-in';
  }
> = {
  not_found: {
    eyebrow: '// Link not recognised',
    title: "We couldn't find that invite.",
    description:
      "Either the link was mistyped, or the invite no longer exists. Ask whoever invited you to send a fresh link.",
    action: 'request-new',
  },
  expired: {
    eyebrow: '// Link expired',
    title: 'This invite has expired.',
    description:
      "Invites are good for 7 days. Ask whoever invited you to resend — they can do it from their Team tab in two clicks.",
    action: 'request-new',
  },
  consumed: {
    eyebrow: '// Already accepted',
    title: 'This invite has already been used.',
    description:
      "If that was you, sign in with the password you set. If it wasn't, contact Webnua support — someone may have intercepted the link.",
    action: 'sign-in',
  },
  revoked: {
    eyebrow: '// Link revoked',
    title: 'This invite was cancelled.',
    description:
      'The person who invited you cancelled the invite. Reach out to them if you still need access.',
    action: 'request-new',
  },
};
