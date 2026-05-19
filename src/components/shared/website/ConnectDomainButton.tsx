'use client';

// =============================================================================
// ConnectDomainButton — operator affordance on the /website hub to point a
// client's own domain at their Webnua site.
//
// Connecting does two things: registers the domain with the Vercel project
// (POST /api/domains → HTTPS cert) and stores it as the website's
// `domain_primary` (setCustomDomain). The middleware + public resolver then
// serve the site on that host once the customer's DNS is pointed — the dialog
// shows exactly which DNS record to add.
//
// Operator-only — mounted behind a role check on the hub. The `websites`
// UPDATE RLS is operator-only too, so setCustomDomain runs here cleanly.
// =============================================================================

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase/client';
import { dnsRecordsFor, normalizeDomain } from '@/lib/website/domain';
import { clearCustomDomain, setCustomDomain } from '@/lib/website/mutations';
import type { Website } from '@/lib/website/types';

type VercelStatus =
  | { configured: false }
  | {
      configured: true;
      ok: true;
      verified: boolean;
      verification: { type: string; domain: string; value: string }[];
    }
  | { configured: true; ok: false; error: string };

type Phase = 'form' | 'busy' | 'connected';

/** A non-`.webnua.dev` primary host is a connected custom domain. */
function customHost(host: string): string | null {
  return host && !host.endsWith('.webnua.dev') ? host : null;
}

export function ConnectDomainButton({ website }: { website: Website }) {
  const connected = customHost(website.domain.primary);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {connected ? 'Manage domain' : 'Connect domain →'}
      </Button>
      {open ? <ConnectDomainDialog website={website} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ConnectDomainDialog({ website, onClose }: { website: Website; onClose: () => void }) {
  const connected = customHost(website.domain.primary);
  const [phase, setPhase] = useState<Phase>(connected ? 'connected' : 'form');
  const [input, setInput] = useState('');
  const [domain, setDomain] = useState<string | null>(connected);
  const [error, setError] = useState<string | null>(null);
  const [vercel, setVercel] = useState<VercelStatus | null>(null);

  const handleConnect = async () => {
    setError(null);
    const normalized = normalizeDomain(input);
    if (!normalized) {
      setError('Enter a valid domain, e.g. example.com or www.example.com.');
      return;
    }
    setPhase('busy');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setError('Your session has expired — sign in again.');
        setPhase('form');
        return;
      }
      const res = await fetch('/api/domains', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ domain: normalized }),
      });
      if (res.status === 403) {
        setError('Connecting a domain is an operator-only action.');
        setPhase('form');
        return;
      }
      const body = (await res.json().catch(() => ({}))) as {
        vercel?: VercelStatus;
      };
      // Save the domain on the website row regardless of the Vercel result —
      // the resolver serves it once Vercel has the domain; the status line
      // tells the operator whether anything is still owed.
      const saved = await setCustomDomain(website.id, normalized);
      if (!saved) {
        setError('Could not save the domain. Check you have operator access.');
        setPhase('form');
        return;
      }
      setVercel(body.vercel ?? { configured: false });
      setDomain(normalized);
      setPhase('connected');
    } catch {
      setError('Something went wrong reaching the domain service.');
      setPhase('form');
    }
  };

  const handleDisconnect = async () => {
    if (!domain) return;
    setPhase('busy');
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        await fetch('/api/domains', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ domain }),
        }).catch(() => {});
      }
      await clearCustomDomain(website.id);
      onClose();
    } catch {
      setError('Could not disconnect the domain.');
      setPhase('connected');
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {phase === 'form' ? 'Connect a custom domain' : 'Custom domain'}
          </DialogTitle>
          <DialogDescription>
            {phase === 'form'
              ? 'Point a domain you already own at this website. You will get the DNS record to add at your registrar.'
              : 'Add the DNS record below at your domain registrar. Once it propagates the site goes live on this domain over HTTPS.'}
          </DialogDescription>
        </DialogHeader>

        {phase !== 'form' && domain ? (
          <ConnectedView
            domain={domain}
            vercel={vercel}
            busy={phase === 'busy'}
            error={error}
            onDisconnect={handleDisconnect}
            onChangeDomain={() => {
              setPhase('form');
              setInput('');
              setError(null);
              setVercel(null);
            }}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                Domain
              </span>
              <Input
                value={input}
                placeholder="example.com"
                disabled={phase === 'busy'}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleConnect();
                }}
              />
            </label>
            {error ? (
              <p className="text-[13px] text-warn">{error}</p>
            ) : (
              <p className="text-[13px] leading-[1.5] text-ink-quiet">
                Enter the bare domain (<span className="font-mono">example.com</span>) or a
                subdomain (<span className="font-mono">www.example.com</span>
                ). You keep your existing <span className="font-mono">.webnua.dev</span> address
                too.
              </p>
            )}
            <div className="mt-1 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose} disabled={phase === 'busy'}>
                Cancel
              </Button>
              <Button onClick={() => void handleConnect()} disabled={phase === 'busy'}>
                {phase === 'busy' ? 'Connecting…' : 'Connect domain'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConnectedView({
  domain,
  vercel,
  busy,
  error,
  onDisconnect,
  onChangeDomain,
}: {
  domain: string;
  vercel: VercelStatus | null;
  busy: boolean;
  error: string | null;
  onDisconnect: () => void;
  onChangeDomain: () => void;
}) {
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const records = dnsRecordsFor(domain);
  const verification = vercel && vercel.configured && vercel.ok ? vercel.verification : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-rule bg-paper px-4 py-3">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          Connected domain
        </p>
        <p className="mt-1 font-mono text-[15px] font-bold text-ink">{domain}</p>
      </div>

      <VercelNote vercel={vercel} />

      <div>
        <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          DNS record to add
        </p>
        <p className="mb-2 text-[13px] leading-[1.5] text-ink-quiet">
          At your domain registrar, add the record that matches your domain — an{' '}
          <strong className="font-semibold text-ink">A record</strong> for a root domain, a{' '}
          <strong className="font-semibold text-ink">CNAME</strong> for a subdomain like{' '}
          <span className="font-mono">www</span>.
        </p>
        <div className="overflow-hidden rounded-lg border border-rule">
          {records.map((r, i) => (
            <div
              key={r.type}
              className={
                'grid grid-cols-[64px_1fr] gap-2 px-3 py-2 font-mono text-[12px]' +
                (i > 0 ? ' border-t border-rule' : '')
              }
            >
              <span className="font-bold text-rust">{r.type}</span>
              <span className="text-ink">
                <span className="text-ink-quiet">name</span> {r.name}
                {'   '}
                <span className="text-ink-quiet">value</span> {r.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {verification.length > 0 ? (
        <div>
          <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            Verification record(s)
          </p>
          <p className="mb-2 text-[13px] leading-[1.5] text-ink-quiet">
            This domain also needs a verification record before HTTPS is issued:
          </p>
          <div className="overflow-hidden rounded-lg border border-rule">
            {verification.map((v, i) => (
              <div
                key={`${v.domain}-${i}`}
                className={
                  'px-3 py-2 font-mono text-[12px] text-ink' +
                  (i > 0 ? ' border-t border-rule' : '')
                }
              >
                <span className="font-bold text-rust">{v.type}</span>{' '}
                <span className="text-ink-quiet">name</span> {v.domain}{' '}
                <span className="text-ink-quiet">value</span> {v.value}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="text-[13px] text-warn">{error}</p> : null}

      <div className="mt-1 flex items-center justify-between gap-2">
        {confirmingDisconnect ? (
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-ink-mid">Disconnect this domain?</span>
            <Button variant="destructive" size="sm" disabled={busy} onClick={onDisconnect}>
              {busy ? 'Working…' : 'Disconnect'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setConfirmingDisconnect(false)}
            >
              Keep it
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setConfirmingDisconnect(true)}
          >
            Disconnect domain
          </Button>
        )}
        <Button variant="secondary" size="sm" disabled={busy} onClick={onChangeDomain}>
          Use a different domain
        </Button>
      </div>
    </div>
  );
}

function VercelNote({ vercel }: { vercel: VercelStatus | null }) {
  if (!vercel) return null;
  if (!vercel.configured) {
    return (
      <p className="rounded-lg border border-rule bg-paper-2 px-3 py-2 text-[13px] leading-[1.5] text-ink-mid">
        Domain saved. A Webnua operator needs to add it in the Vercel dashboard to finish HTTPS
        setup.
      </p>
    );
  }
  if (!vercel.ok) {
    return (
      <p className="rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-[13px] leading-[1.5] text-warn">
        Domain saved, but the hosting provider rejected it: {vercel.error}
      </p>
    );
  }
  return (
    <p className="rounded-lg border border-good/30 bg-good/5 px-3 py-2 text-[13px] leading-[1.5] text-ink-mid">
      Registered with the hosting provider. HTTPS is issued automatically once your DNS record is
      detected — usually within an hour.
    </p>
  );
}
