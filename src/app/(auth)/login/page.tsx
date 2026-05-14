'use client';

// STUB — placeholder "login". Two buttons set the stubbed role and route to
// the matching shell. Replace with the real Supabase auth flow.

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { ROLE_LANDING, useRole, type Role } from '@/lib/auth/role-stub';

export default function LoginPage() {
  const router = useRouter();
  const { setRole } = useRole();

  const handlePick = (role: Role) => {
    setRole(role);
    router.push(ROLE_LANDING[role]);
  };

  return (
    <div className="flex w-full max-w-md flex-col items-stretch gap-7 rounded-2xl border border-rule bg-card p-10 shadow-card">
      <div className="flex flex-col items-start gap-2">
        <Eyebrow tone="rust">{'// Stub login'}</Eyebrow>
        <h1 className="text-3xl font-extrabold tracking-[-0.03em] text-ink">
          Pick a role to continue.
        </h1>
        <p className="text-sm text-ink-quiet">
          Real auth ships with the backend. For now, choose which shell to land
          in.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Button onClick={() => handlePick('client')} size="lg">
          Continue as client →
        </Button>
        <Button
          onClick={() => handlePick('admin')}
          size="lg"
          variant="secondary"
        >
          Continue as admin →
        </Button>
      </div>
    </div>
  );
}
