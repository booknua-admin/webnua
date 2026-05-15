import type { Metadata } from 'next';
import { Inter_Tight, JetBrains_Mono } from 'next/font/google';

import { TooltipProvider } from '@/components/ui/tooltip';
import { UserProvider } from '@/lib/auth/user-stub';
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
        <UserProvider>
          <WorkspaceProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </WorkspaceProvider>
        </UserProvider>
      </body>
    </html>
  );
}
