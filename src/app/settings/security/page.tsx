'use client';

// =============================================================================
// /settings/security — login + security.
//
// Pattern B critical-fix: this used to render hardcoded stub credentials,
// fake 2FA enrolment, and a Voltline session list — no values were real, no
// affordance had a backend. Now reads the live signed-in user's email,
// supports a real password change via `supabase.auth.updateUser`, and shows
// the current session honestly (Supabase JS only exposes the active session
// — listing other devices needs a server call we don't yet have, so we
// surface that limitation rather than pretend).
//
// 2FA enrolment is deferred — Supabase Auth supports TOTP MFA but the enrol
// flow needs QR-code rendering + verification UX. Stub-section copy
// acknowledges it as a "coming soon" item rather than displaying a fake
// "Enable 2FA" button that does nothing.
// =============================================================================

import { useEffect, useState } from 'react';

import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUser } from '@/lib/auth/user-stub';
import { supabase } from '@/lib/supabase/client';

export default function ClientSettingsSecurityPage() {
  const user = useUser();

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Login + security" />} />
      <SettingsShell
        eyebrow={`${user?.displayName ?? 'Your account'} · security`}
        title={
          <>
            Your <em>login</em>.
          </>
        }
        subtitle={
          <>
            Password and session for the account that controls leads, bookings, and
            customer data.{' '}
            <strong>If you ever sign in from a device you don&rsquo;t recognise</strong>,
            change your password immediately and open a ticket.
          </>
        }
      >
        <SettingsPanel>
          <CredentialsSection email={user?.email ?? null} />
          <PasswordSection />
          <TwoFactorSection />
          <SessionSection email={user?.email ?? null} />
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}

function CredentialsSection({ email }: { email: string | null }) {
  return (
    <SettingsSection
      heading={
        <>
          Login <em>email</em>
        </>
      }
      description="Your login is the email you signed up with. Changing the login email needs operator help — open a ticket if you need to swap it."
    >
      <div className="rounded-lg border border-rule bg-paper px-5 py-4 text-[14px] font-mono text-ink">
        {email ?? 'Resolving…'}
      </div>
    </SettingsSection>
  );
}

function PasswordSection() {
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const reset = () => {
    setNext('');
    setConfirm('');
  };

  async function submit() {
    setError(null);
    setOk(false);
    if (next.length < 12) {
      setError('Use 12+ characters with a mix of cases and numbers.');
      return;
    }
    if (next !== confirm) {
      setError('The two passwords don’t match.');
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setOk(true);
      reset();
      window.setTimeout(() => setOk(false), 3000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsSection
      heading={
        <>
          Change <em>password</em>
        </>
      }
      description="Set a new password. Sign-out across other devices is recommended after a password change — use the button at the bottom of this page."
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[220px_1fr] sm:items-center sm:gap-4">
          <label className="text-[13px] font-semibold text-ink" htmlFor="security-new-password">
            New password
          </label>
          <Input
            id="security-new-password"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            placeholder="At least 12 characters"
            className="h-9"
          />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[220px_1fr] sm:items-center sm:gap-4">
          <label className="text-[13px] font-semibold text-ink" htmlFor="security-confirm-password">
            Confirm new password
          </label>
          <Input
            id="security-confirm-password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            placeholder="Re-enter the new password"
            className="h-9"
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-end gap-3">
          {error ? (
            <p className="text-[12px] font-semibold text-warn">{error}</p>
          ) : ok ? (
            <p className="text-[12px] font-semibold text-good">Password updated ✓</p>
          ) : null}
          <Button onClick={submit} disabled={busy || !next || !confirm}>
            {busy ? 'Updating…' : 'Update password'}
          </Button>
        </div>
      </div>
    </SettingsSection>
  );
}

function TwoFactorSection() {
  return (
    <SettingsSection
      heading={
        <>
          Two-factor <em>authentication</em>
        </>
      }
      description="Extra protection for the account. We're rolling this out as a follow-up — Supabase Auth supports TOTP MFA, but the enrolment UX (QR code + recovery codes) isn't wired here yet."
    >
      <div className="flex items-center justify-between gap-4 rounded-lg border border-dashed border-rule bg-paper px-5 py-4">
        <div className="text-[13px] leading-[1.5] text-ink-quiet">
          <strong className="text-ink">Coming soon.</strong> Until 2FA lands here, keep a
          strong unique password and don&rsquo;t share your login email.
        </div>
        <Button variant="outline" size="sm" disabled>
          Enable 2FA
        </Button>
      </div>
    </SettingsSection>
  );
}

function SessionSection({ email }: { email: string | null }) {
  const [signingOut, setSigningOut] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const issued = data.session?.user?.last_sign_in_at;
      if (issued) setSessionStartedAt(new Date(issued).toLocaleString());
    });
  }, []);

  async function signOutEverywhere() {
    if (signingOut) return;
    if (!window.confirm('Sign out of every device including this one? You’ll need to log back in.')) {
      return;
    }
    setSigningOut(true);
    try {
      // 'global' revokes every active refresh token for this user across
      // every device. The current tab is included.
      await supabase.auth.signOut({ scope: 'global' });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <SettingsSection
      heading={
        <>
          Active <em>sessions</em>
        </>
      }
      description="Listing every signed-in device individually needs a server-side enumeration we don't yet have. For now you can see this device + sign out of every device at once."
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-rule bg-paper px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-rust">
                This device
              </span>
              <span className="text-[13px] font-semibold text-ink">
                {email ?? 'Current session'}
              </span>
            </div>
            <div className="mt-0.5 text-[12px] text-ink-quiet">
              {sessionStartedAt ? `Signed in: ${sessionStartedAt}` : 'Active session'}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end">
          <Button variant="outline" onClick={signOutEverywhere} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out of every device'}
          </Button>
        </div>
      </div>
    </SettingsSection>
  );
}
