// =============================================================================
// /onboarding — Pattern B onboarding wizard layout.
//
// Standalone layout (no sidebar / Topbar) — the wizard is a focused
// conversion surface. The customer signed up for Webnua to get a site;
// distractions are the enemy. The layout supplies just the BrandMark
// header + a generous mobile-friendly canvas. Resumes land on the same
// shell regardless of step.
//
// 'use client' because the dashboard's route guard relies on client-side
// React Router state; layouts in the App Router that compose client
// components don't need 'use client' themselves, but the page below does.
// =============================================================================

import type { ReactNode } from 'react';

import { BrandMark } from '@/components/ui/BrandMark';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-paper">
      <header className="border-b border-rule bg-card">
        <div className="mx-auto flex max-w-4xl items-center px-4 py-4 md:px-8 md:py-5">
          <BrandMark className="text-ink" />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 md:px-8 md:py-10">
        {children}
      </main>
    </div>
  );
}
