'use client';

// Dev session control. Floating bottom-right pill.
//
// Phase 2 (real auth): user-switching is gone — sign-in is real. What remains
// is the operator view-as impersonation control (cycles the stub roster, see
// user-stub.tsx) + sign out + the /dev/capabilities link. Mounted in the
// (client)/(admin) + shared-route layouts; remove the mounts when a real
// account menu lands.

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { STUB_USER_DEFS, useUserContext } from '@/lib/auth/user-stub';
import { cn } from '@/lib/utils';

function DevRoleSwitcher() {
  const router = useRouter();
  const { user, viewAsUser, hydrated, clearUser, setViewAsUserId } =
    useUserContext();

  if (!hydrated || !user) return null;

  const handleSignOut = () => {
    clearUser();
    router.push('/login');
  };

  // View-as is admin-only. Cycle: none → first client → second client → none.
  const isAdmin = user.role === 'admin';
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
      <span className="text-paper/55">{'// DEV'}</span>
      <span className="text-rust">
        {user.displayName.toLowerCase()} ({user.role})
        {viewAsUser ? (
          <span className="ml-1 text-rust-light">
            [as {viewAsUser.displayName.toLowerCase()}]
          </span>
        ) : null}
      </span>
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
          <span className="text-paper/30">|</span>
          <Link
            href="/dev/capabilities"
            className="rounded px-2 py-0.5 text-paper/55 transition-colors hover:text-paper"
          >
            caps ↗
          </Link>
        </>
      ) : null}
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
