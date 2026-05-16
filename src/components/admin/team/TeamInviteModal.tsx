'use client';

import { useState } from 'react';
import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useUser } from '@/lib/auth/user-stub';
import { adminClients, type AdminClient } from '@/lib/nav/admin-clients';
import { TEAM_ROLES, getTeamRoleDef, type TeamRole } from '@/lib/team/roles';
import type { TeamInvite, TeamInviteDraft } from '@/lib/team/types';
import { InviteStepper } from './InviteStepper';
import { PermissionPreview } from './PermissionPreview';
import { RoleSelectCard } from './RoleSelectCard';

type TeamInviteModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const EMPTY_DRAFT: TeamInviteDraft = {
  email: '',
  fullName: '',
  role: 'junior',
  assignedClientIds: [],
  personalNote: '',
};

const INVITE_TTL_DAYS = 7;

function TeamInviteModal({ open, onOpenChange }: TeamInviteModalProps) {
  const user = useUser();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [draft, setDraft] = useState<TeamInviteDraft>(EMPTY_DRAFT);
  const [sentInvite, setSentInvite] = useState<TeamInvite | null>(null);

  const isJunior = draft.role === 'junior';
  const displayName = draft.fullName.trim() || 'your teammate';
  const inviteeFirstName = draft.fullName.trim().split(' ')[0] || 'your teammate';

  // Step 1 → 2 is gated on a real email, and on at least one client for the
  // junior role (junior access is meaningless without an assigned client).
  const canContinue =
    draft.email.trim().length > 0 &&
    (!isJunior || draft.assignedClientIds.length > 0);

  function reset() {
    setStep(1);
    setDraft(EMPTY_DRAFT);
    setSentInvite(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function patch(fields: Partial<TeamInviteDraft>) {
    setDraft((prev) => ({ ...prev, ...fields }));
  }

  function toggleClient(clientId: string) {
    setDraft((prev) => ({
      ...prev,
      assignedClientIds: prev.assignedClientIds.includes(clientId)
        ? prev.assignedClientIds.filter((id) => id !== clientId)
        : [...prev.assignedClientIds, clientId],
    }));
  }

  // Builds the one discrete, attributable invite record (vision §7) and
  // advances to the confirmation step. Backend pass replaces the body with a
  // real INSERT + email send; the TeamInvite shape stays the contract.
  function handleSend() {
    const now = new Date();
    const expires = new Date(now.getTime() + INVITE_TTL_DAYS * 86_400_000);
    const token = (
      globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`
    ).replace(/-/g, '');
    const invite: TeamInvite = {
      ...draft,
      // junior is scoped to assigned clients; owner/operator see all clients
      // by role, so the assignment list is not theirs to carry.
      assignedClientIds: isJunior ? draft.assignedClientIds : [],
      id: `inv_${token.slice(0, 12)}`,
      invitedBy: user?.id ?? 'craig',
      invitedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      magicLink: `https://app.webnua.io/invite/wb_${token.slice(0, 16)}`,
      status: 'pending',
    };
    console.log('[stub] team invite issued', invite);
    setSentInvite(invite);
    setStep(3);
  }

  const assignedClients = adminClients.filter((c) =>
    draft.assignedClientIds.includes(c.id),
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        size="lg"
        showCloseButton={false}
        className="flex max-h-[calc(100vh-4rem)] flex-col gap-0 overflow-hidden rounded-[14px] border-rule bg-card p-0"
      >
        <ModalHeader
          tag={
            step === 3
              ? '// Invite sent · Step 3 of 3'
              : `// Invite team member · Step ${step} of 3`
          }
          tagTone={step === 3 ? 'good' : 'rust'}
          title={
            step === 1 ? (
              <>
                Add <em>someone</em> to Webnua Perth
              </>
            ) : step === 2 ? (
              <>
                Review what <em>{inviteeFirstName}</em> can do
              </>
            ) : (
              <>
                Invite sent to <em>{inviteeFirstName}</em>
              </>
            )
          }
          subtitle={
            step === 1
              ? "They'll get an email with a magic link to set their password and join your workspace. Invites expire in 7 days."
              : step === 2
                ? 'Permissions are based on the role and clients you picked. Confirm before sending the invite.'
                : 'Email is on its way. The link is also copyable below if you want to send it directly via Slack or WhatsApp.'
          }
          onClose={() => handleOpenChange(false)}
        />

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          <InviteStepper steps={3} current={step} />

          {step === 1 ? (
            <Step1
              draft={draft}
              displayName={displayName}
              isJunior={isJunior}
              clients={adminClients}
              onPatch={patch}
              onToggleClient={toggleClient}
            />
          ) : null}

          {step === 2 ? (
            <Step2
              draft={draft}
              inviteeFirstName={inviteeFirstName}
              isJunior={isJunior}
              assignedClients={assignedClients}
            />
          ) : null}

          {step === 3 && sentInvite ? (
            <Step3 invite={sentInvite} inviteeFirstName={inviteeFirstName} />
          ) : null}
        </div>

        <ModalFooter
          info={
            step === 1
              ? 'Step 1 of 3 · Next: review permissions'
              : step === 2
                ? 'Step 2 of 3 · Next: send invite'
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
                onClick={() => setStep(2)}
              >
                Continue →
              </Button>
            </>
          ) : null}
          {step === 2 ? (
            <>
              <Button
                variant="ghost"
                className="h-9"
                onClick={() => setStep(1)}
              >
                ← Back
              </Button>
              <Button
                variant="secondary"
                className="h-9"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button className="h-9" onClick={handleSend}>
                Confirm + send invite →
              </Button>
            </>
          ) : null}
          {step === 3 ? (
            <>
              <Button
                variant="secondary"
                className="h-9"
                onClick={reset}
              >
                Invite another
              </Button>
              <Button
                className="h-9"
                onClick={() => handleOpenChange(false)}
              >
                Done · back to team →
              </Button>
            </>
          ) : null}
        </ModalFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — invite form
// ---------------------------------------------------------------------------

type Step1Props = {
  draft: TeamInviteDraft;
  displayName: string;
  isJunior: boolean;
  clients: AdminClient[];
  onPatch: (fields: Partial<TeamInviteDraft>) => void;
  onToggleClient: (clientId: string) => void;
};

function Step1({
  draft,
  displayName,
  isJunior,
  clients,
  onPatch,
  onToggleClient,
}: Step1Props) {
  return (
    <>
      <InviteSection
        heading="Who are you inviting?"
        sub="Enter their work email. We'll send the invite immediately."
      >
        <FieldLabel required>Email address</FieldLabel>
        <Input
          type="email"
          className="bg-paper"
          placeholder="name@webnua.io"
          value={draft.email}
          onChange={(e) => onPatch({ email: e.target.value })}
        />
        <FieldLabel className="mt-3.5">
          Full name{' '}
          <span className="font-semibold text-ink-quiet">
            (optional · they can edit)
          </span>
        </FieldLabel>
        <Input
          className="bg-paper"
          placeholder="First Last"
          value={draft.fullName}
          onChange={(e) => onPatch({ fullName: e.target.value })}
        />
      </InviteSection>

      <InviteSection
        heading="What role?"
        sub="You can change this later from Settings · Team."
      >
        <div className="grid grid-cols-3 gap-2.5">
          {TEAM_ROLES.map((role) => (
            <RoleSelectCard
              key={role.id}
              icon={role.icon}
              name={role.name}
              description={role.description}
              selected={draft.role === role.id}
              onSelect={() => onPatch({ role: role.id as TeamRole })}
            />
          ))}
        </div>
      </InviteSection>

      <InviteSection
        heading={`Which clients can ${displayName} access?`}
        sub={
          isJunior ? (
            <>
              Junior operators only see clients you explicitly assign.{' '}
              <strong>
                {draft.assignedClientIds.length} of {clients.length} selected.
              </strong>
            </>
          ) : (
            'Owners and operators access every client in the workspace — no assignment needed.'
          )
        }
      >
        {isJunior ? (
          <div className="flex flex-col gap-1.5">
            {clients.map((client) => (
              <ClientAccessRow
                key={client.id}
                client={client}
                checked={draft.assignedClientIds.includes(client.id)}
                onToggle={() => onToggleClient(client.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-rule bg-paper px-4 py-3.5 font-sans text-[12px] text-ink-quiet">
            All {clients.length} clients · workspace-wide access by role.
          </div>
        )}
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
        sub={`Included in the invite email. Helps ${displayName} understand the context.`}
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

type ClientAccessRowProps = {
  client: AdminClient;
  checked: boolean;
  onToggle: () => void;
};

function ClientAccessRow({ client, checked, onToggle }: ClientAccessRowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className={cn(
        'grid grid-cols-[24px_32px_1fr] items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors hover:border-rust',
        checked ? 'border-rust bg-rust-soft/60' : 'border-rule bg-paper',
      )}
    >
      <span
        className={cn(
          'flex h-[18px] w-[18px] items-center justify-center rounded border-2 text-[12px] font-extrabold text-paper',
          checked
            ? 'border-rust bg-rust'
            : 'border-rule bg-card text-transparent',
        )}
      >
        ✓
      </span>
      <span className="flex h-8 w-8 items-center justify-center rounded-[7px] bg-ink font-sans text-[12px] font-extrabold text-rust-light">
        {client.initial}
      </span>
      <span className="font-sans text-[13px] font-bold text-ink">
        {client.name}
        <span className="mt-0.5 block font-mono text-[10px] font-semibold uppercase tracking-[0.04em] text-ink-quiet">
          {client.meta}
        </span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — permissions preview
// ---------------------------------------------------------------------------

type Step2Props = {
  draft: TeamInviteDraft;
  inviteeFirstName: string;
  isJunior: boolean;
  assignedClients: AdminClient[];
};

function Step2({
  draft,
  inviteeFirstName,
  isJunior,
  assignedClients,
}: Step2Props) {
  const roleDef = getTeamRoleDef(draft.role);
  const clientNames = assignedClients.map((c) => c.name);
  const scopeLabel = isJunior
    ? clientNames.length > 0
      ? joinNames(clientNames)
      : 'their assigned clients'
    : 'every client';
  const metaLine = isJunior
    ? `${draft.email || 'no email'} · ${assignedClients.length} client${
        assignedClients.length === 1 ? '' : 's'
      } assigned`
    : `${draft.email || 'no email'} · all clients`;

  return (
    <>
      <div className="mb-3.5 grid grid-cols-[44px_1fr_auto] items-center gap-3.5 rounded-xl bg-ink px-5.5 py-4.5">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-rust-light to-rust font-sans text-[15px] font-extrabold text-paper">
          {initials(draft.fullName, draft.email)}
        </span>
        <span>
          <span className="block font-sans text-[15px] font-bold text-paper">
            {draft.fullName.trim() || 'Pending teammate'}
          </span>
          <span className="block font-mono text-[11px] tracking-[0.04em] text-paper/65">
            {metaLine}
          </span>
        </span>
        <span className="rounded-full bg-rust px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-paper">
          {roleDef.name}
        </span>
      </div>

      <PermissionPreview
        role={draft.role}
        heading={`What ${inviteeFirstName} can do on ${scopeLabel}`}
        description={
          isJunior ? (
            <>
              {clientNames.length > 0 ? joinNames(clientNames) : 'Assigned clients'}{' '}
              only. {inviteeFirstName} will not see other clients anywhere in
              the platform.
            </>
          ) : (
            <>Workspace-wide — {inviteeFirstName} can access every client.</>
          )
        }
      />

      <div className="rounded-[10px] border border-rust bg-rust-soft px-5 py-[18px]">
        <div className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-rust">
          {'// What happens after invite'}
        </div>
        <p className="font-sans text-[13px] leading-[1.6] text-ink [&_strong]:font-semibold">
          {inviteeFirstName} gets an email at{' '}
          <strong>{draft.email || 'their address'}</strong> with a magic link
          to set their password. After accepting, they&apos;ll land on the
          dashboard
          {isJunior ? ` filtered to ${scopeLabel}` : ''}.
          {draft.personalNote.trim() ? (
            <> Your personal note will be shown at the top of their first login.</>
          ) : null}
        </p>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — confirmation
// ---------------------------------------------------------------------------

function Step3({
  invite,
  inviteeFirstName,
}: {
  invite: TeamInvite;
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
        link expires <strong>{expiresOn}</strong>. You&apos;ll see
        &ldquo;invite pending&rdquo; on the Team screen until they accept.
      </p>

      <CopyLinkRow url={invite.magicLink} />

      <div className="rounded-[10px] bg-paper px-5 py-4">
        <div className="mb-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
          {'// What happens next'}
        </div>
        {[
          `${inviteeFirstName} opens the link, sets a password, and lands on the dashboard.`,
          'You can revoke the invite anytime from Settings · Team before it’s accepted.',
          'Once accepted, their permissions are immediately active — no further action needed.',
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

function CopyLinkRow({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mb-3.5 grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-dashed border-rule bg-paper px-4 py-3">
      <span className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] tracking-[0.02em] text-ink-soft">
        {url}
      </span>
      <button
        type="button"
        onClick={copy}
        className="rounded-md bg-ink px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-paper transition-colors hover:bg-rust"
      >
        {copied ? 'Copied ✓' : 'Copy link'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared modal chrome
// ---------------------------------------------------------------------------

type ModalHeaderProps = {
  tag: string;
  tagTone: 'rust' | 'good';
  title: React.ReactNode;
  subtitle: string;
  onClose: () => void;
};

function ModalHeader({ tag, tagTone, title, subtitle, onClose }: ModalHeaderProps) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-paper-2 px-7 pt-5.5 pb-4">
      <div className="flex-1">
        <div
          className={cn(
            'mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
            tagTone === 'good' ? 'text-good' : 'text-rust',
          )}
        >
          {tag}
        </div>
        <DialogTitle className="mb-1.5 text-[24px] font-extrabold leading-[1.1] tracking-[-0.025em] text-ink [&_em]:not-italic [&_em]:text-rust">
          {title}
        </DialogTitle>
        <p className="text-[13px] leading-[1.45] text-ink-quiet">{subtitle}</p>
      </div>
      <DialogPrimitive.Close
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-2 font-mono text-[16px] text-ink-quiet transition-colors hover:bg-ink hover:text-paper"
        aria-label="Close"
        onClick={onClose}
      >
        <XIcon className="size-4" />
      </DialogPrimitive.Close>
    </div>
  );
}

function ModalFooter({
  info,
  children,
}: {
  info: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-paper-2 bg-paper px-7 py-4">
      <div className="flex-1 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-quiet">
        {info}
      </div>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

type InviteSectionProps = {
  heading: React.ReactNode;
  sub: React.ReactNode;
  last?: boolean;
  children: React.ReactNode;
};

function InviteSection({ heading, sub, last, children }: InviteSectionProps) {
  return (
    <div className={cn(last ? 'mb-0' : 'mb-5.5')}>
      <div className="mb-1 font-sans text-[15px] font-extrabold tracking-[-0.015em] text-ink">
        {heading}
      </div>
      <div className="mb-4 font-sans text-[13px] leading-[1.5] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
        {sub}
      </div>
      {children}
    </div>
  );
}

function FieldLabel({
  children,
  required,
  className,
}: {
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn(
        'mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet',
        className,
      )}
    >
      {children}
      {required ? <span className="text-rust"> *</span> : null}
    </label>
  );
}

function initials(fullName: string, email: string): string {
  const name = fullName.trim();
  if (name) {
    const parts = name.split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
  }
  return (email.trim()[0] ?? '?').toUpperCase();
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

export { TeamInviteModal };
export type { TeamInviteModalProps };
