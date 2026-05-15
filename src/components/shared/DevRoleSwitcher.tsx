'use client';

// STUB — part of the role-stub deletion set (see src/lib/auth/role-stub.tsx).
// This floating dev-only pill lets you flip between client/admin and clear the
// stubbed role. Remove this component when real auth ships.

import { useRouter } from 'next/navigation';

import { ROLE_LANDING, useRole, type Role } from '@/lib/auth/user-stub';
import { cn } from '@/lib/utils';

function DevRoleSwitcher() {
  const router = useRouter();
  const { role, hydrated, setRole, clearRole } = useRole();

  if (!hydrated) return null;

  const handleSwitch = (next: Role) => {
    setRole(next);
    router.push(ROLE_LANDING[next]);
  };

  const handleSignOut = () => {
    clearRole();
    router.push('/login');
  };

  return (
    <div
      data-slot="dev-role-switcher"
      className="fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-pill border border-rule bg-ink/95 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-paper shadow-card"
    >
      <span className="text-paper/55">{'// STUB'}</span>
      <span className="text-rust">role: {role ?? 'none'}</span>
      <span className="text-paper/30">|</span>
      <button
        type="button"
        onClick={() => handleSwitch('client')}
        className={cn(
          'rounded px-2 py-0.5 transition-colors',
          role === 'client'
            ? 'bg-rust text-paper'
            : 'text-paper/55 hover:text-paper',
        )}
      >
        client
      </button>
      <button
        type="button"
        onClick={() => handleSwitch('admin')}
        className={cn(
          'rounded px-2 py-0.5 transition-colors',
          role === 'admin'
            ? 'bg-rust text-paper'
            : 'text-paper/55 hover:text-paper',
        )}
      >
        admin
      </button>
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
