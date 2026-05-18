import type { ReactNode } from 'react';

import type { ClientStatus } from '@/components/admin/ClientListRow';

export type DashboardStat = {
  label: string;
  value: ReactNode;
  trend?: string;
  trendTone?: 'good' | 'quiet';
};

export type MidSetupClient = {
  id: string;
  tag: string;
  businessName: string;
  description: string;
  stepLabel: string;
  ownerName: string;
  ownerPhone: string;
  website: string;
  continueHref: string;
};

export type LiveClient = {
  id: string;
  initial: string;
  name: string;
  meta: string;
  status: ClientStatus;
  leadsPerWeek: number;
  spend: string;
  href: string;
};
