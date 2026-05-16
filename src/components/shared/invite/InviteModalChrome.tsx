// =============================================================================
// Invite-modal chrome — the structural rhythm shared by the operator-side
// TeamInviteModal and the client-side ClientTeamInviteModal.
//
// Extracted at the second use (CLAUDE.md cardinal rule). This is deliberately
// the INTERSECTION of what both modals need — the header rail, the scrollable
// body wrapper, the footer rail, and the two small in-body primitives both
// forms use. Anything only one modal needs (role-pick, client-assignment,
// multi-client name joining) stays composed in that modal, not bolted on here
// as an optional prop.
// =============================================================================

import { useState } from 'react';
import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// The DialogContent className both modals apply. Each modal still composes its
// own <Dialog>/<DialogContent size="lg"> — only the chrome class is shared.
export const INVITE_DIALOG_CONTENT_CLASS =
  'flex max-h-[calc(100vh-4rem)] flex-col gap-0 overflow-hidden rounded-[14px] border-rule bg-card p-0';

// ---------------------------------------------------------------------------
// Header rail — rust/good mono tag + title + subtitle + close button.
// ---------------------------------------------------------------------------

type InviteModalHeaderProps = {
  tag: string;
  tagTone: 'rust' | 'good';
  title: React.ReactNode;
  subtitle: string;
  onClose: () => void;
};

export function InviteModalHeader({
  tag,
  tagTone,
  title,
  subtitle,
  onClose,
}: InviteModalHeaderProps) {
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

// ---------------------------------------------------------------------------
// Footer rail — mono info line on the left, action buttons on the right.
// ---------------------------------------------------------------------------

type InviteModalFooterProps = {
  info: string;
  children: React.ReactNode;
};

export function InviteModalFooter({ info, children }: InviteModalFooterProps) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-paper-2 bg-paper px-7 py-4">
      <div className="flex-1 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-quiet">
        {info}
      </div>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// In-body primitives — a labelled form section and a mono field label.
// ---------------------------------------------------------------------------

type InviteSectionProps = {
  heading: React.ReactNode;
  sub: React.ReactNode;
  last?: boolean;
  children: React.ReactNode;
};

export function InviteSection({ heading, sub, last, children }: InviteSectionProps) {
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

type InviteFieldLabelProps = {
  children: React.ReactNode;
  required?: boolean;
  className?: string;
};

export function InviteFieldLabel({
  children,
  required,
  className,
}: InviteFieldLabelProps) {
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

// ---------------------------------------------------------------------------
// Copy-link row — the dashed-border magic-link row on both confirmation steps.
// ---------------------------------------------------------------------------

export function InviteCopyLinkRow({ url }: { url: string }) {
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
// Helper — initials from a full name, falling back to the email.
// ---------------------------------------------------------------------------

export function inviteInitials(fullName: string, email: string): string {
  const name = fullName.trim();
  if (name) {
    const parts = name.split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
  }
  return (email.trim()[0] ?? '?').toUpperCase();
}
