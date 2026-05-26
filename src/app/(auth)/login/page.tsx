'use client';

// Sign-in screen — real Supabase Auth (Phase 2). The email + password form
// authenticates against Supabase; on success the UserProvider's auth listener
// resolves the session and we route to the role landing.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSignInSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      // Generic message: avoids leaking whether the email exists. Supabase's
      // raw message ("Invalid login credentials" / "User not found") would
      // help an attacker enumerate accounts.
      setError('Email or password is incorrect.');
      setSubmitting(false);
      return;
    }

    // The UserProvider auth listener picks up the session; route to the app.
    router.push('/dashboard');
  };

  return (
    <div className="flex w-full max-w-md flex-col items-stretch gap-8">
      <div className="flex flex-col items-center gap-3 text-ink">
        <img src="/webnua-logo.png" alt="Webnua" width={160} height={40} className="h-10 w-auto" />
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>

            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Button
                  asChild
                  variant="link"
                  className="h-auto p-0 font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-rust"
                >
                  <Link href="/forgot-password">Forgot password?</Link>
                </Button>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn"
              >
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? 'Signing in…' : 'Sign in →'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-[13px] text-ink-quiet">
        New to Webnua?{' '}
        <Link href="/sign-up" className="font-semibold text-rust hover:text-rust-deep">
          Start a subscription →
        </Link>
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
