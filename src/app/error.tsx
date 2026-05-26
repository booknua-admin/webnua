'use client';

import { useEffect } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/ui/BrandMark';
import { Eyebrow } from '@/components/ui/eyebrow';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to operator + ops tooling; the browser console is the only sink
    // wired today. Real telemetry (Sentry / Vercel error reporting) lands
    // separately when production observability is wired.
    console.error('[app error boundary]', error);
  }, [error]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-paper px-6 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center text-ink">
        <BrandMark size="lg" className="text-ink" />

        <div className="flex flex-col items-center gap-3">
          <Eyebrow tone="rust">{'// Something went wrong'}</Eyebrow>
          <h1 className="text-[32px] leading-[1.1] font-extrabold tracking-[-0.03em] text-ink">
            We hit a snag.
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-ink-quiet">
            An unexpected error happened loading this page. The Webnua team
            has been notified. Try again, or head back to your dashboard.
          </p>
          {error.digest ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
              Ref: {error.digest}
            </p>
          ) : null}
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button size="lg" onClick={() => reset()}>
            Try again →
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
