'use client';

// STUB — part of the user-stub deletion set (see src/lib/auth/user-stub.tsx).
// Floating dev-only pill that lets you switch between the three stubbed users
// and clear the active user. The caps↗ link opens the capability matrix at
// /dev/capabilities for visual review of <CapabilityGate> behaviour across
// users × modes. Remove this component when real auth ships.

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  ROLE_LANDING,
  STUB_USERS,
  useUserContext,
} from '@/lib/auth/user-stub';
import { cn } from '@/lib/utils';

function DevRoleSwitcher() {
  const router = useRouter();
  const { user, hydrated, setUserId, clearUser } = useUserContext();

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

  return (
    <div
      data-slot="dev-role-switcher"
      className="fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-pill border border-rule bg-ink/95 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-paper shadow-card"
    >
      <span className="text-paper/55">{'// STUB'}</span>
      <span className="text-rust">
        user: {user ? `${user.displayName.toLowerCase()} (${user.role})` : 'none'}
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
