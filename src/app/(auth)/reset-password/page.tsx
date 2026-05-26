'use client';

import { useEffect, useState } from 'react';
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

// The Supabase password-reset email redirects to this page. The auth client
// auto-detects the recovery hash + opens a temporary session bound to the
// PASSWORD_RECOVERY event. While that session is live, `auth.updateUser` can
// set a new password without re-authenticating.

export default function ResetPasswordPage() {
  const router = useRouter();
  const [hasRecoverySession, setHasRecoverySession] = useState<
    'checking' | 'ready' | 'missing'
  >('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Detect whether we landed here from a recovery link or by typing the URL
  // directly. The Supabase client fires a PASSWORD_RECOVERY event when the
  // recovery hash is consumed; we also check existing session as a fallback
  // because event delivery is racey on first mount.
  useEffect(() => {
    let cancelled = false;

    const settle = (next: 'ready' | 'missing') => {
      if (!cancelled) setHasRecoverySession(next);
    };

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY') settle('ready');
        else if (event === 'SIGNED_IN' && session) settle('ready');
      },
    );

    // Fallback: if the listener didn't fire within 600ms, probe the session.
    const probeTimer = window.setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      settle(data.session ? 'ready' : 'missing');
    }, 600);

    return () => {
      cancelled = true;
      window.clearTimeout(probeTimer);
      subscription.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    setDone(true);
    setSubmitting(false);
    // Give the user a beat to see the confirmation, then route to dashboard.
    window.setTimeout(() => router.push('/dashboard'), 1500);
  };

  return (
    <div className="flex w-full max-w-md flex-col items-stretch gap-8">
      <div className="flex flex-col items-center gap-3 text-ink">
        <img
          src="/webnua-logo.png"
          alt="Webnua"
          width={160}
          height={40}
          className="h-10 w-auto"
        />
        <Eyebrow tone="quiet">{'// Webnua platform'}</Eyebrow>
      </div>

      <Card className="gap-7 py-8">
        <CardHeader className="gap-2">
          <Eyebrow tone="rust">{'// Set new password'}</Eyebrow>
          <CardTitle className="text-[28px] leading-[1.1] font-extrabold tracking-[-0.03em] text-ink">
            Choose a new password.
          </CardTitle>
          <CardDescription className="text-sm text-ink-quiet">
            At least 8 characters. You&apos;ll be signed in straight away.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {hasRecoverySession === 'checking' ? (
            <p className="rounded-md border border-rule bg-paper px-3 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-quiet">
              {'// Loading recovery session…'}
            </p>
          ) : hasRecoverySession === 'missing' ? (
            <div className="flex flex-col gap-4 rounded-md border border-warn/30 bg-warn/10 px-4 py-4">
              <p className="text-sm text-ink">
                This page is reached from the password-reset email. The link
                may have expired, or you visited this URL directly.
              </p>
              <Button asChild variant="secondary">
                <Link href="/forgot-password">Request a new reset link →</Link>
              </Button>
            </div>
          ) : done ? (
            <p
              role="status"
              className="rounded-md border border-good/30 bg-good/10 px-3 py-3 text-sm text-ink"
            >
              Password updated. Redirecting to your dashboard…
            </p>
          ) : (
            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="new-password"
                  className="font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-ink"
                >
                  New password
                </label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="confirm-password"
                  className="font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-ink"
                >
                  Confirm
                </label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
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
                {submitting ? 'Saving…' : 'Set new password →'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
