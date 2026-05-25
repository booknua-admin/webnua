'use client';

// =============================================================================
// /dev/extraction-preview — off-nav dev surface for the conversational
// onboarding's extraction step. Paste a candidate first-message into the
// textarea and see what /api/onboarding/extract-business returns (the
// discriminated `{ refused: true, refuseReason }` vs `{ refused: false,
// extraction }` shape).
//
// Used to sanity-check the catch-all classification — "car valet in perth"
// resolves to `generic`, "I run a coffee shop" → `refuse:restaurant`, etc.
// — without going through the full /sign-up + verification + extract flow
// every time. The route is rate-limited Anthropic-side, so a few invocations
// per minute is fine.
//
// Convention: `app/dev/*` is off-nav developer-only. Don't link to it from
// production nav. Deletion-point lives alongside /dev/sections.
// =============================================================================

import { useCallback, useState } from 'react';

import { BrandMark } from '@/components/ui/BrandMark';
import { Eyebrow } from '@/components/ui/eyebrow';
import type {
  ConversationExtraction,
  RefuseReason,
} from '@/lib/onboarding/conversation-types';

type ResponseBody =
  | { refused: true; refuseReason: RefuseReason }
  | { refused: false; extraction: ConversationExtraction }
  | { error: string; detail?: string; status?: number };

const SUGGESTIONS: { label: string; message: string }[] = [
  {
    label: 'Electrician (trade)',
    message: 'Electrician in Perth, 15 years, residential rewires + EV chargers',
  },
  { label: 'Car valet (generic)', message: 'car valet in perth' },
  {
    label: 'Dog groomer (generic)',
    message: 'I do dog grooming, mostly small breeds, mobile in Auckland',
  },
  {
    label: 'Accountant (generic)',
    message: "I'm an accountant for small businesses",
  },
  {
    label: 'Photographer (generic)',
    message: 'Wedding photographer covering all of Ireland',
  },
  {
    label: 'Personal trainer (generic)',
    message: 'personal trainer in Galway, just me at the moment',
  },
  { label: 'Coffee shop (refuse: restaurant)', message: 'I run a coffee shop in Galway' },
  {
    label: 'Cafe (refuse: restaurant)',
    message: 'We have a cafe with takeaway',
  },
  {
    label: 'Personal chef (NOT a restaurant)',
    message: "I'm a personal chef cooking for private events in clients' homes",
  },
  {
    label: 'Sneaker store (refuse: ecom)',
    message: 'I sell sneakers on Shopify',
  },
  {
    label: 'Dropshipping (refuse: ecom)',
    message: 'I run a dropshipping store',
  },
  {
    label: 'Tutor (generic)',
    message: 'Tutoring business — primary school maths',
  },
  {
    label: 'Ambiguous (low-confidence)',
    message: 'we do houses',
  },
];

export default function ExtractionPreviewPage() {
  const [message, setMessage] = useState('car valet in perth');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ResponseBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const runExtraction = useCallback(async () => {
    if (!message.trim()) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    setLatencyMs(null);
    const startedAt = Date.now();
    try {
      const res = await fetch('/api/onboarding/extract-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstMessage: message }),
      });
      const body = (await res.json().catch(() => ({}))) as ResponseBody;
      setLatencyMs(Date.now() - startedAt);
      if (!res.ok) {
        setError(`${res.status} ${res.statusText}`);
        setResponse(body);
        return;
      }
      setResponse(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [message]);

  return (
    <div className="min-h-svh bg-paper px-4 py-8 md:px-10 md:py-12">
      <header className="mb-8 flex items-center justify-between">
        <BrandMark className="text-ink" />
        <Eyebrow tone="quiet">{'// dev / extraction-preview'}</Eyebrow>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* Inputs */}
        <section className="rounded-2xl border border-rule bg-card p-6">
          <Eyebrow tone="rust" bullet>
            Input
          </Eyebrow>
          <h1 className="mt-2 text-[20px] font-extrabold tracking-[-0.02em] text-ink">
            First-message sandbox
          </h1>
          <p className="mt-2 text-[13px] text-ink-soft">
            Paste a candidate first-message and POST to{' '}
            <code className="font-mono text-rust">
              /api/onboarding/extract-business
            </code>{' '}
            in isolation. No verification, no workspace mutation — just
            extraction.
          </p>

          <label className="mt-5 block font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink">
            First message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="mt-2 block w-full rounded-lg border border-rule bg-paper px-3 py-2 font-mono text-[13px] text-ink focus:border-rust focus:outline-none"
            placeholder="e.g. car valet in perth"
          />

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={!message.trim() || loading}
              onClick={runExtraction}
              className="inline-flex h-10 items-center rounded-md bg-rust px-5 text-[13px] font-bold uppercase tracking-[0.02em] text-paper hover:bg-rust-deep disabled:opacity-50"
            >
              {loading ? 'Extracting…' : 'Run extraction'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMessage('');
                setResponse(null);
                setError(null);
              }}
              className="inline-flex h-10 items-center rounded-md border border-rule bg-card px-4 text-[12px] uppercase tracking-[0.02em] text-ink-quiet hover:border-ink hover:text-ink"
            >
              Clear
            </button>
          </div>

          <div className="mt-6">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
              {'// Quick test cases'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setMessage(s.message)}
                  className="rounded-md border border-rule bg-paper-2 px-2.5 py-1.5 text-left text-[11px] text-ink-soft hover:border-rust hover:text-ink"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Output */}
        <section className="rounded-2xl border border-rule bg-card p-6">
          <div className="flex items-center justify-between">
            <Eyebrow tone="rust" bullet>
              Response
            </Eyebrow>
            {latencyMs != null ? (
              <span className="font-mono text-[10px] text-ink-quiet">
                {latencyMs} ms
              </span>
            ) : null}
          </div>

          {!response && !error ? (
            <p className="mt-4 text-[13px] text-ink-quiet">
              Run an extraction to see the structured response.
            </p>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-md border border-warn/40 bg-warn/[0.08] px-3 py-2 font-mono text-[12px] text-warn">
              {error}
            </div>
          ) : null}

          {response && 'refused' in response && response.refused === true ? (
            <div className="mt-4 space-y-3">
              <p className="rounded-md border border-warn/40 bg-warn/[0.08] px-3 py-2 text-[13px] text-ink">
                <strong className="font-bold uppercase tracking-[0.04em] text-warn">
                  Refused
                </strong>
                {' — '}
                <span className="font-mono">{response.refuseReason}</span>
                {' — the shell would mount '}
                <code className="font-mono">ChatRefuseScreen</code>{' '}
                + POST {'/api/clients/[id]/refuse-signup'} to flip the
                workspace to <code className="font-mono">banned</code>.
              </p>
            </div>
          ) : null}

          {response && 'refused' in response && response.refused === false ? (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <Cell label="Industry" value={response.extraction.industry} />
                <Cell
                  label="Confidence"
                  value={`${(response.extraction.confidence * 100).toFixed(0)}%`}
                />
                <Cell
                  label="Industry free-text"
                  value={response.extraction.industryFreeText ?? '(null)'}
                />
                <Cell
                  label="Industry description"
                  value={response.extraction.industryDescription || '(empty)'}
                />
                <Cell
                  label="Location"
                  value={response.extraction.location || '(empty)'}
                />
                <Cell
                  label="Specialty"
                  value={response.extraction.specialty || '(empty)'}
                />
                <Cell
                  label="Team size"
                  value={response.extraction.teamSize || '(empty)'}
                />
              </div>
              {response.extraction.mentionedServices.length > 0 ? (
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                    {'// Mentioned services'}
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-[13px] text-ink-soft">
                    {response.extraction.mentionedServices.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {response.extraction.ambiguities.length > 0 ? (
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-warn">
                    {'// Ambiguities (clarifying question would fire)'}
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-[13px] text-ink-soft">
                    {response.extraction.ambiguities.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {response ? (
            <details className="mt-6">
              <summary className="cursor-pointer font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet hover:text-ink">
                {'// Raw response JSON'}
              </summary>
              <pre className="mt-2 max-h-[400px] overflow-auto rounded-md bg-paper-2 p-3 font-mono text-[11px] text-ink">
                {JSON.stringify(response, null, 2)}
              </pre>
            </details>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {label}
      </div>
      <div className="mt-0.5 text-[13px] text-ink">{value}</div>
    </div>
  );
}
