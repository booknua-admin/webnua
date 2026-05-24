'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';

// =============================================================================
// EditorMobileGuard — polite "open this on a computer" screen for the section
// editor routes. Wraps every editor page (`/website/[pageId]`, `/website/header`,
// `/website/footer`, `/funnels/[id]/edit/[stepId]`).
//
// `builder-design.md` carves out the editor as desktop-only (V2 mobile work);
// rather than ship the broken 1fr/400px grid on a phone, we render this guard
// at <md. Other surfaces — viewing the published site, checking leads,
// managing settings — keep working on mobile.
//
// Implementation: render BOTH the guard (visible only <md via md:hidden) AND
// the children (visible only ≥md via the wrapper `hidden md:block`). Avoids
// a layout-toggling JS read of viewport width that would flicker on mount.
// =============================================================================

type EditorMobileGuardProps = {
  children: React.ReactNode;
};

function EditorMobileGuard({ children }: EditorMobileGuardProps) {
  return (
    <>
      <div className="flex min-h-[calc(100svh-68px)] items-center justify-center px-6 py-12 md:hidden">
        <div className="mx-auto flex max-w-[420px] flex-col gap-5 text-center">
          <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust">
            {'// Editor'}
          </div>
          <h1 className="text-[26px] font-extrabold leading-[1.1] tracking-[-0.02em] text-ink">
            This works best on a computer.
          </h1>
          <p className="text-[14px] leading-[1.55] text-ink-mid">
            Editing your site uses precision tools — section reorder, copy
            tuning, side-by-side preview — that need a larger screen and a
            real cursor.
          </p>
          <p className="text-[13px] leading-[1.55] text-ink-quiet">
            Open this URL on a laptop or desktop, or jump back to your
            dashboard to keep working on mobile.
          </p>
          <div className="mt-2 flex flex-col gap-2.5">
            <Button asChild>
              <Link href="/dashboard">Open dashboard</Link>
            </Button>
          </div>
        </div>
      </div>
      <div className="hidden md:block">{children}</div>
    </>
  );
}

export { EditorMobileGuard };
