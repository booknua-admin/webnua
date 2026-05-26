import type { Metadata } from 'next';
import { Inter_Tight, JetBrains_Mono } from 'next/font/google';

import { TooltipProvider } from '@/components/ui/tooltip';
import { UserProvider } from '@/lib/auth/user-stub';
import { DataHydrationProvider } from '@/lib/data/DataHydrationProvider';
import { QueryProvider } from '@/lib/query/QueryProvider';
import { RealtimeProvider } from '@/lib/realtime/RealtimeProvider';
import { WorkspaceProvider } from '@/lib/workspace/workspace-stub';

import './globals.css';

const interTight = Inter_Tight({
  variable: '--font-inter-tight',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Webnua',
  description: 'Webnua platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${interTight.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Skip-to-content link — hidden until keyboard-focused, then jumps
         *  past the sidebar + topbar nav to the page's main content. Routes
         *  without a `<main id="main-content">` (e.g. auth) silently no-op. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:font-mono focus:text-[12px] focus:font-bold focus:uppercase focus:tracking-[0.08em] focus:text-paper focus:shadow-md focus:outline-none focus:ring-2 focus:ring-rust"
        >
          Skip to main content
        </a>
        <QueryProvider>
          <UserProvider>
            <DataHydrationProvider>
              <WorkspaceProvider>
                <RealtimeProvider>
                  <TooltipProvider>{children}</TooltipProvider>
                </RealtimeProvider>
              </WorkspaceProvider>
            </DataHydrationProvider>
          </UserProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
