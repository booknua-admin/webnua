'use client';

// =============================================================================
// CapabilityToggleGrid — per-user, per-website capability switches.
//
// One "card" per client user; inside each card, one row per website the user
// has access to; inside each row, a wrapping flex of <Switch>-and-label cells
// (one cell per capability).
//
// The component owns no state — capabilities are derived from the user's
// resolved set (see user-stub.tsx) and toggling fires the onToggle callback
// up to the parent, which calls `setUserGrant` on the user-stub context.
//
// Role-default capabilities (viewBuilder for clients) are rendered as
// always-on disabled switches — clients can't be revoked below their role
// floor. Operators don't appear in this grid; they have workspace-wide
// access through their role.
// =============================================================================

import {
  ADMIN_DEFAULTS,
  ALL_CAPABILITIES,
  CLIENT_DEFAULTS,
  type Capability,
  type Role,
} from '@/lib/auth/capabilities';
import type { StubWebsite } from '@/lib/auth/user-stub';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export type CapabilityToggleGridUser = {
  id: string;
  displayName: string;
  email: string;
  role: Role;
  websites: StubWebsite[];
  /** Resolved capability set for this user across all their websites. */
  capabilities: Set<Capability>;
};

export type CapabilityToggleGridProps = {
  users: CapabilityToggleGridUser[];
  /** Fires when a capability switch toggles for a given (user, website). */
  onToggle: (
    userId: string,
    websiteId: string,
    capability: Capability,
    enabled: boolean,
  ) => void;
};

export function CapabilityToggleGrid({ users, onToggle }: CapabilityToggleGridProps) {
  if (users.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-rule bg-paper px-5 py-6 text-center text-[13px] text-ink-quiet">
        No client users yet. Invite a client user from the Team tab to grant
        access.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {users.map((user) => (
        <UserGrantCard key={user.id} user={user} onToggle={onToggle} />
      ))}
    </div>
  );
}

function UserGrantCard({
  user,
  onToggle,
}: {
  user: CapabilityToggleGridUser;
  onToggle: CapabilityToggleGridProps['onToggle'];
}) {
  const heldCount = user.capabilities.size;
  const totalCount = ALL_CAPABILITIES.length;
  const roleFloor = new Set<Capability>(
    user.role === 'admin' ? ADMIN_DEFAULTS : CLIENT_DEFAULTS,
  );

  return (
    <div className="overflow-hidden rounded-lg border border-rule bg-paper">
      <div className="flex items-start justify-between gap-4 border-b border-rule bg-paper-2 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-mono text-[12px] font-bold text-rust-light"
          >
            {user.displayName.charAt(0)}
          </span>
          <div>
            <p className="text-[14px] font-bold text-ink">
              {user.displayName}{' '}
              <span className="font-normal text-ink-quiet">· {user.email}</span>
            </p>
            <p className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
              {user.role} · {heldCount}/{totalCount} caps
            </p>
          </div>
        </div>
      </div>

      <div>
        {user.websites.length === 0 ? (
          <p className="px-5 py-4 text-[12px] text-ink-quiet">
            No websites yet for this user.
          </p>
        ) : (
          user.websites.map((website, i) => (
            <WebsiteGrantRow
              key={website.id}
              user={user}
              website={website}
              roleFloor={roleFloor}
              onToggle={onToggle}
              isLast={i === user.websites.length - 1}
            />
          ))
        )}
      </div>
    </div>
  );
}

function WebsiteGrantRow({
  user,
  website,
  roleFloor,
  onToggle,
  isLast,
}: {
  user: CapabilityToggleGridUser;
  website: StubWebsite;
  roleFloor: Set<Capability>;
  onToggle: CapabilityToggleGridProps['onToggle'];
  isLast: boolean;
}) {
  return (
    <div
      className={cn(
        'px-5 py-4',
        !isLast && 'border-b border-paper-2',
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-ink">
          {website.clientName}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
          {website.domain}
        </p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-4 gap-y-2.5">
        {ALL_CAPABILITIES.map((cap) => {
          const enabled = user.capabilities.has(cap);
          const isFloor = roleFloor.has(cap);
          return (
            <div
              key={cap}
              className={cn(
                'flex items-center',
                isFloor && 'opacity-60',
              )}
              title={
                isFloor
                  ? `Role default for ${user.role} — cannot be revoked.`
                  : undefined
              }
            >
              <Switch
                checked={enabled}
                disabled={isFloor}
                onCheckedChange={(next) =>
                  onToggle(user.id, website.id, cap, next)
                }
                label={cap}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
