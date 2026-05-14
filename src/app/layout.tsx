import type { Metadata } from 'next';
import { Inter_Tight, JetBrains_Mono } from 'next/font/google';

import { TooltipProvider } from '@/components/ui/tooltip';
import { RoleProvider } from '@/lib/auth/role-stub';

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
        <RoleProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </RoleProvider>
      </body>
    </html>
  );
}
