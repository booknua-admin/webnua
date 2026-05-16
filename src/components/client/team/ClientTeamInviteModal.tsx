'use client';

// =============================================================================
// ClientTeamInviteModal — a client business owner invites a user into their
// own client account.
//
// Sibling of the operator-side TeamInviteModal, scoped down: the client is
// fixed (the inviter's own — no client picker), and there is no role pick. A
// client invitee gets the flat CLIENT_DEFAULTS floor (`viewBuilder` only);
// per-website edit grants stay an operator concern via /settings/access. With
// no role/access decision to review, the flow is 2 steps, not 3 — inventing a
// review step for a flat invite would be drift (same logic as Session 3's
// Step-2 call). The access reality is communicated inline on Step 1 instead.
//
// The send is seat-limit gated: pending invites + existing users must be
// under the client's seat limit. canInviteToClient() backs both the Continue
// gate and the final send guard.
// =============================================================================

import { useState } from 'react';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  INVITE_DIALOG_CONTENT_CLASS,
  InviteCopyLinkRow,
  InviteFieldLabel,
  InviteModalFooter,
  InviteModalHeader,
  InviteSection,
} from '@/components/shared/invite/InviteModalChrome';
import { SeatUsageMeter } from '@/components/client/team/SeatUsageMeter';
import { useUser } from '@/lib/auth/user-stub';
import { addClientInvite } from '@/lib/invites/client-invite-stub';
import type { ClientUserInvite, ClientUserInviteDraft } from '@/lib/invites/client-invite';
import { canInviteToClient, type SeatUsage } from '@/lib/invites/seats';
import { INVITE_TTL_DAYS } from '@/lib/invites/shared-types';
import { useClientSeatUsage } from '@/lib/invites/use-seat-usage';
import { adminClients } from '@/lib/nav/admin-clients';

type ClientTeamInviteModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The client business the invitee joins — the inviter's own client. */
  clientId: string;
};

const EMPTY_DRAFT: ClientUserInviteDraft = {
  email: '',
  fullName: '',
  personalNote: '',
};

function ClientTeamInviteModal({
  open,
  onOpenChange,
  clientId,
}: ClientTeamInviteModalProps) {
  const user = useUser();
  const usage = useClientSeatUsage(clientId);
  const [step, setStep] = useState<1 | 2>(1);
  const [draft, setDraft] = useState<ClientUserInviteDraft>(EMPTY_DRAFT);
  const [sentInvite, setSentInvite] = useState<ClientUserInvite | null>(null);

  const clientName =
    adminClients.find((c) => c.id === clientId)?.name ?? 'your account';
  const inviteeFirstName =
    draft.fullName.trim().split(' ')[0] || 'your teammate';

  const eligibility = canInviteToClient(clientId);
  const seatBlocked = !eligibility.allowed;
  const canContinue = draft.email.trim().length > 0 && !seatBlocked;

  function reset() {
    setStep(1);
    setDraft(EMPTY_DRAFT);
    setSentInvite(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function patch(fields: Partial<ClientUserInviteDraft>) {
    setDraft((prev) => ({ ...prev, ...fields }));
  }

  // Builds the one discrete, attributable invite record (vision §7). The send
  // is guarded again here — the seat count could have moved while the modal
  // was open. Backend pass replaces the body with a real INSERT + email send;
  // the ClientUserInvite shape stays the contract.
  function handleSend() {
    if (!canInviteToClient(clientId).allowed) return;
    const now = new Date();
    const expires = new Date(now.getTime() + INVITE_TTL_DAYS * 86_400_000);
    const token = (
      globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`
    ).replace(/-/g, '');
    const note = draft.personalNote.trim();
    const invite: ClientUserInvite = {
      id: `cinv_${token.slice(0, 12)}`,
      email: draft.email.trim(),
      fullName: draft.fullName.trim(),
      clientId,
      invitedBy: user?.id ?? 'unknown',
      invitedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      magicLink: `https://app.webnua.io/invite/wb_${token.slice(0, 16)}`,
      status: 'pending',
      personalNote: note.length > 0 ? note : null,
    };
    addClientInvite(invite);
    console.log('[stub] client teammate invite issued', invite);
    setSentInvite(invite);
    setStep(2);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        size="lg"
        showCloseButton={false}
        className={INVITE_DIALOG_CONTENT_CLASS}
      >
        <InviteModalHeader
          tag={
            step === 2
              ? '// Invite sent · Step 2 of 2'
              : '// Invite a teammate · Step 1 of 2'
          }
          tagTone={step === 2 ? 'good' : 'rust'}
          title={
            step === 1 ? (
              <>
                Add someone to <em>{clientName}</em>
              </>
            ) : (
              <>
                Invite sent to <em>{inviteeFirstName}</em>
              </>
            )
          }
          subtitle={
            step === 1
              ? "They'll get an email with a magic link to set their password and join your account. Invites expire in 7 days."
              : 'Email is on its way. The link is also copyable below if you want to send it directly via text or WhatsApp.'
          }
          onClose={() => handleOpenChange(false)}
        />

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          {step === 1 ? (
            <Step1
              draft={draft}
              clientName={clientName}
              seatBlocked={seatBlocked}
              usage={usage}
              onPatch={patch}
            />
          ) : null}
          {step === 2 && sentInvite ? (
            <Step2 invite={sentInvite} inviteeFirstName={inviteeFirstName} />
          ) : null}
        </div>

        <InviteModalFooter
          info={
            step === 1
              ? 'Step 1 of 2 · Next: send invite'
              : sentInvite
                ? `Invite ${sentInvite.id} · expires in ${INVITE_TTL_DAYS} days`
                : ''
          }
        >
          {step === 1 ? (
            <>
              <Button
                variant="secondary"
                className="h-9"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                className="h-9"
                disabled={!canContinue}
                onClick={handleSend}
              >
                Send invite →
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" className="h-9" onClick={reset}>
                Invite another
              </Button>
              <Button className="h-9" onClick={() => handleOpenChange(false)}>
                Done · back to team →
              </Button>
            </>
          )}
        </InviteModalFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — invite form
// ---------------------------------------------------------------------------

type Step1Props = {
  draft: ClientUserInviteDraft;
  clientName: string;
  seatBlocked: boolean;
  usage: SeatUsage;
  onPatch: (fields: Partial<ClientUserInviteDraft>) => void;
};

function Step1({ draft, clientName, seatBlocked, usage, onPatch }: Step1Props) {
  return (
    <>
      <InviteSection
        heading="Who are you inviting?"
        sub="Enter their email. We'll send the invite immediately."
      >
        <InviteFieldLabel required>Email address</InviteFieldLabel>
        <Input
          type="email"
          className="bg-paper"
          placeholder="name@example.com"
          value={draft.email}
          onChange={(e) => onPatch({ email: e.target.value })}
        />
        <InviteFieldLabel className="mt-3.5">
          Full name{' '}
          <span className="font-semibold text-ink-quiet">
            (optional · they can edit)
          </span>
        </InviteFieldLabel>
        <Input
          className="bg-paper"
          placeholder="First Last"
          value={draft.fullName}
          onChange={(e) => onPatch({ fullName: e.target.value })}
        />
      </InviteSection>

      <InviteSection
        heading="What your teammate can do"
        sub={
          <>
            Teammates can <strong>view</strong> {clientName}&apos;s website,
            funnels, leads, and bookings. Editing access is managed by Webnua —
            ask Craig to grant edit permissions for anyone who needs them.
          </>
        }
      >
        <div className="rounded-[10px] border border-rule bg-paper px-5 py-4">
          <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
            {'// Default access'}
          </div>
          {[
            'See your website and funnels in the page builder',
            'View leads, bookings, reviews, and campaign activity',
            'No editing or publishing until Webnua grants it',
          ].map((line) => (
            <p
              key={line}
              className="border-b border-paper-2 py-1.5 font-sans text-[12px] leading-[1.5] text-ink-soft last:border-b-0"
            >
              {line}
            </p>
          ))}
        </div>
      </InviteSection>

      <InviteSection
        heading="Seats"
        sub="Each teammate uses one seat. Pending invites count too."
      >
        <SeatUsageMeter usage={usage} />
        {seatBlocked ? (
          <div className="mt-3 rounded-[10px] border border-rust bg-rust-soft px-5 py-3.5">
            <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-rust">
              {'// Seat limit reached'}
            </div>
            <p className="font-sans text-[13px] leading-[1.5] text-ink">
              You&apos;ve used every seat on your plan. Contact Webnua to add
              more before inviting another teammate.
            </p>
          </div>
        ) : null}
      </InviteSection>

      <InviteSection
        heading={
          <>
            Personal note{' '}
            <span className="text-[13px] font-semibold text-ink-quiet">
              (optional)
            </span>
          </>
        }
        sub="Included in the invite email. Helps them understand the context."
        last
      >
        <Textarea
          className="min-h-[88px] bg-paper font-sans"
          placeholder="Add a short welcome note…"
          value={draft.personalNote}
          onChange={(e) => onPatch({ personalNote: e.target.value })}
        />
      </InviteSection>
    </>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — confirmation
// ---------------------------------------------------------------------------

function Step2({
  invite,
  inviteeFirstName,
}: {
  invite: ClientUserInvite;
  inviteeFirstName: string;
}) {
  const sentAt = new Date(invite.invitedAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  const expiresOn = new Date(invite.expiresAt).toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <>
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-good-soft font-sans text-[28px] font-black text-good">
        ✓
      </div>
      <div className="text-center font-sans text-[22px] font-extrabold tracking-[-0.025em] text-ink">
        {inviteeFirstName}&apos;s invite is{' '}
        <em className="not-italic text-rust">live</em>
      </div>
      <p className="mx-auto mt-2 mb-5.5 max-w-[440px] text-center font-sans text-[14px] leading-[1.5] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
        Email sent to <strong>{invite.email}</strong> at {sentAt}. The magic
        link expires <strong>{expiresOn}</strong>. You&apos;ll see &ldquo;invite
        pending&rdquo; on the Team tab until they accept.
      </p>

      <InviteCopyLinkRow url={invite.magicLink} />

      <div className="rounded-[10px] bg-paper px-5 py-4">
        <div className="mb-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
          {'// What happens next'}
        </div>
        {[
          `${inviteeFirstName} opens the link, sets a password, and joins your account.`,
          'They start with view-only access — ask Webnua to grant editing.',
          'The invite holds one seat until accepted or it expires.',
        ].map((line) => (
          <p
            key={line}
            className="border-b border-paper-2 py-2 font-sans text-[13px] leading-[1.5] text-ink-soft last:border-b-0"
          >
            {line}
          </p>
        ))}
      </div>
    </>
  );
}

export { ClientTeamInviteModal };
export type { ClientTeamInviteModalProps };
