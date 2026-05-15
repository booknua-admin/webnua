'use client';

// Sign-in screen. Visual layer over the role-stub mechanism — the email +
// password fields are inert until Supabase wires in. The two role buttons
// below the divider are the dev stub, identical in behaviour to before.

import { useRouter } from 'next/navigation';

import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Input } from '@/components/ui/input';
import { ROLE_LANDING, useRole, type Role } from '@/lib/auth/user-stub';

export default function LoginPage() {
  const router = useRouter();
  const { setRole } = useRole();

  const handleSignInSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Inert until Supabase auth ships. Use the role-stub buttons below.
  };

  const handlePick = (role: Role) => {
    setRole(role);
    router.push(ROLE_LANDING[role]);
  };

  return (
    <div className="flex w-full max-w-md flex-col items-stretch gap-8">
      <div className="flex flex-col items-center gap-3 text-ink">
        <BrandMark size="lg" />
        <Eyebrow tone="quiet">{'// Webnua platform'}</Eyebrow>
      </div>

      <Card className="gap-7 py-8">
        <CardHeader className="gap-2">
          <Eyebrow tone="rust">{'// Sign in'}</Eyebrow>
          <CardTitle className="text-[28px] leading-[1.1] font-extrabold tracking-[-0.03em] text-ink">
            Welcome back.
          </CardTitle>
          <CardDescription className="text-sm text-ink-quiet">
            Use the email tied to your workspace. We&apos;ll keep you signed in
            on this device.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form className="flex flex-col gap-5" onSubmit={handleSignInSubmit}>
            <Field id="email" label="Email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@yourbusiness.com"
                required
              />
            </Field>

            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-rust"
                >
                  Forgot password?
                </Button>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••••"
                required
              />
            </div>

            <Button type="submit" size="lg" className="w-full">
              Sign in →
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex-col items-stretch gap-4 border-t border-rule pt-6">
          <div className="flex items-center justify-between">
            <Eyebrow tone="quiet">{'// Dev role stub'}</Eyebrow>
            <span className="font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-ink-quiet/70">
              Removed at launch
            </span>
          </div>
          <p className="text-xs leading-relaxed text-ink-quiet">
            Real auth ships with the backend. For now, pick which shell to land
            in.
          </p>
          <div className="flex flex-col gap-2.5">
            <Button
              type="button"
              onClick={() => handlePick('client')}
              variant="secondary"
              size="lg"
            >
              Continue as client →
            </Button>
            <Button
              type="button"
              onClick={() => handlePick('admin')}
              variant="secondary"
              size="lg"
            >
              Continue as admin →
            </Button>
          </div>
        </CardFooter>
      </Card>

      <p className="text-center font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-ink-quiet/70">
        &copy; Webnua &middot; Perth
      </p>
    </div>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
    </div>
  );
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-ink"
    >
      {children}
    </label>
  );
}
