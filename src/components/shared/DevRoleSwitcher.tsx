'use client';

// STUB — part of the user-stub deletion set (see src/lib/auth/user-stub.tsx).
// Floating dev-only pill. Switches between the three stub users, surfaces
// the view-as override for admin sessions, links to the /dev/capabilities
// matrix, and signs out. Remove when real auth ships.

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  ROLE_LANDING,
  STUB_USERS,
  STUB_USER_DEFS,
  useUserContext,
} from '@/lib/auth/user-stub';
import { cn } from '@/lib/utils';

function DevRoleSwitcher() {
  const router = useRouter();
  const {
    user,
    viewAsUser,
    hydrated,
    setUserId,
    clearUser,
    setViewAsUserId,
  } = useUserContext();

  if (!hydrated) return null;

  const handleSwitch = (id: string) => {
    setUserId(id);
    const next = STUB_USERS.find((u) => u.id === id);
    if (next) router.push(ROLE_LANDING[next.role]);
  };

  const handleSignOut = () => {
    clearUser();
    router.push('/login');
  };

  // View-as is admin-only. Cycle button: none → first client → second client → none.
  const isAdmin = user?.role === 'admin';
  const clientUserDefs = STUB_USER_DEFS.filter((u) => u.role === 'client');
  const cycleViewAs = () => {
    const cycle = [null, ...clientUserDefs.map((u) => u.id)];
    const currentIdx = cycle.indexOf(viewAsUser?.id ?? null);
    const nextIdx = (currentIdx + 1) % cycle.length;
    setViewAsUserId(cycle[nextIdx]);
  };

  return (
    <div
      data-slot="dev-role-switcher"
      className="fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-pill border border-rule bg-ink/95 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-paper shadow-card"
    >
      <span className="text-paper/55">{'// STUB'}</span>
      <span className="text-rust">
        user:{' '}
        {user ? `${user.displayName.toLowerCase()} (${user.role})` : 'none'}
        {viewAsUser ? (
          <span className="ml-1 text-rust-light">
            [as {viewAsUser.displayName.toLowerCase()}]
          </span>
        ) : null}
      </span>
      <span className="text-paper/30">|</span>
      {STUB_USERS.map((u) => (
        <button
          key={u.id}
          type="button"
          onClick={() => handleSwitch(u.id)}
          className={cn(
            'rounded px-2 py-0.5 transition-colors',
            user?.id === u.id
              ? 'bg-rust text-paper'
              : 'text-paper/55 hover:text-paper',
          )}
          title={`${u.displayName} · ${u.email} · ${u.capabilities.size} caps`}
        >
          {u.displayName.toLowerCase()}
        </button>
      ))}
      {isAdmin && clientUserDefs.length > 0 ? (
        <>
          <span className="text-paper/30">|</span>
          <button
            type="button"
            onClick={cycleViewAs}
            className={cn(
              'rounded px-2 py-0.5 transition-colors',
              viewAsUser
                ? 'bg-rust-light/20 text-rust-light'
                : 'text-paper/55 hover:text-paper',
            )}
            title="Cycle view-as override (admin only)"
          >
            view as: {viewAsUser?.displayName.toLowerCase() ?? 'none'}
          </button>
        </>
      ) : null}
      <span className="text-paper/30">|</span>
      <Link
        href="/dev/capabilities"
        className="rounded px-2 py-0.5 text-paper/55 transition-colors hover:text-paper"
      >
        caps ↗
      </Link>
      <span className="text-paper/30">|</span>
      <button
        type="button"
        onClick={handleSignOut}
        className="rounded px-2 py-0.5 text-paper/55 transition-colors hover:text-paper"
      >
        sign out
      </button>
    </div>
  );
}

export { DevRoleSwitcher };
