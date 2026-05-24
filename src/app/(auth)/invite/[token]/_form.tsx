'use client';

// =============================================================================
// AcceptInviteForm — the password-set form on /invite/[token].
//
// Two-stage submit:
//   1. POST /api/invites/[token]/accept with { password, fullName? }. On
//      success the server has CREATED the auth user with that password.
//   2. Client-side `supabase.auth.signInWithPassword({ email, password })`
//      to mint a session. The UserProvider's auth listener picks it up
//      and we router.push to the redirect target the API returned.
//
// Returning the email from the API (rather than asking the user to type
// it) avoids a class of "wrong-email at the wrong-token" mistake — the
// token IS the email-binding.
// =============================================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase/client';

type AcceptResponse = {
  ok?: boolean;
  email?: string;
  redirectTo?: string;
  error?: string;
  kind?: string;
  detail?: string;
};

type Props = {
  token: string;
  defaultFullName: string;
  workspaceName: string;
};

const MIN_PASSWORD = 8;

export function AcceptInviteForm({ token, defaultFullName, workspaceName }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(defaultFullName);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'creating' | 'signing-in'>('idle');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD) {
      setError(`Pick a password with at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }

    setPhase('creating');
    let response: Response;
    try {
      response = await fetch(`/api/invites/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password, fullName: fullName.trim() || undefined }),
      });
    } catch {
      setPhase('idle');
      setError('Network error. Check your connection and try again.');
      return;
    }

    const body = (await response.json().catch(() => ({}))) as AcceptResponse;
    if (!response.ok || !body.ok || !body.email) {
      setPhase('idle');
      setError(humaniseError(body, response.status));
      return;
    }

    setPhase('signing-in');
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: body.email,
      password,
    });
    if (signInError) {
      // The account is created — they just couldn't auto-sign-in for some
      // reason. Bounce them to /login with the password they just typed
      // (they'll re-enter; we don't want to ship the password through the
      // URL).
      setPhase('idle');
      setError(
        `Account created. ${signInError.message}. You can sign in with the password you just set.`,
      );
      setTimeout(() => router.push('/login'), 2500);
      return;
    }

    router.push(body.redirectTo ?? '/dashboard');
  }

  const busy = phase !== 'idle';

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor="fullName">Your name</FieldLabel>
        <Input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          placeholder="First Last"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor="password">Set a password</FieldLabel>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={MIN_PASSWORD}
        />
      </div>

      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={MIN_PASSWORD}
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

      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {phase === 'creating'
          ? 'Setting up your account…'
          : phase === 'signing-in'
            ? 'Signing you in…'
            : `Join ${workspaceName} →`}
      </Button>

      <p className="text-center text-[12px] text-ink-quiet">
        By joining you agree to our terms of service.
      </p>
    </form>
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

function humaniseError(body: AcceptResponse, status: number): string {
  const code = body.error ?? '';
  if (status === 429) {
    return 'Too many tries. Wait a few minutes and try again.';
  }
  switch (code) {
    case 'invite-not-found':
      return "We couldn't find that invite — it may have been revoked.";
    case 'invite-already-used':
      return 'This invite has already been used. Try signing in instead.';
    case 'invite-expired':
      return "This invite has expired. Ask whoever invited you to resend.";
    case 'invite-revoked':
      return 'This invite was cancelled. Reach out to whoever invited you.';
    case 'email-already-registered':
      return 'An account with that email already exists. Try signing in.';
    case 'password-too-short':
      return `Pick a password with at least ${MIN_PASSWORD} characters.`;
    case 'password-too-long':
      return 'That password is too long. Try something shorter.';
    default:
      return body.detail || code || 'Something went wrong. Try again or contact support.';
  }
}
