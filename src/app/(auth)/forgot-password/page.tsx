'use client';

import { useState } from 'react';
import Link from 'next/link';

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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/reset-password`
        : undefined;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo },
    );

    if (resetError) {
      // Generic message regardless — same enumeration-protection logic as the
      // login page. Real failures (invalid format, rate limit) still surface
      // their specific message via the catch path on the next attempt.
      console.error('[forgot-password] reset failed:', resetError);
    }

    // Always show "we've sent it" — never confirm whether the email exists.
    setSent(true);
    setSubmitting(false);
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
          <Eyebrow tone="rust">{'// Reset password'}</Eyebrow>
          <CardTitle className="text-[28px] leading-[1.1] font-extrabold tracking-[-0.03em] text-ink">
            Forgot your password?
          </CardTitle>
          <CardDescription className="text-sm text-ink-quiet">
            Enter the email tied to your workspace and we&apos;ll send you a
            link to set a new one.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {sent ? (
            <div
              role="status"
              className="flex flex-col gap-4 rounded-md border border-good/30 bg-good/10 px-4 py-4"
            >
              <p className="text-sm text-ink">
                If an account exists for{' '}
                <strong className="font-semibold">{email.trim()}</strong>,
                we&apos;ve sent a reset link. Check your inbox &mdash; the link
                works for 1 hour.
              </p>
              <p className="text-xs text-ink-mid">
                Don&apos;t see it? Check spam, or try again in a few minutes.
              </p>
            </div>
          ) : (
            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="reset-email"
                  className="font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-ink"
                >
                  Email
                </label>
                <Input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@yourbusiness.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
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
                disabled={submitting || email.trim().length === 0}
              >
                {submitting ? 'Sending…' : 'Send reset link →'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-[13px] text-ink-quiet">
        Remembered it?{' '}
        <Link
          href="/login"
          className="font-semibold text-rust hover:text-rust-deep"
        >
          Back to sign in →
        </Link>
      </p>
    </div>
  );
}
