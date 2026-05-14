import type { Invoice } from '@/components/shared/settings/InvoiceList';

export const clientBillingPlan = {
  tag: '// YOUR PLAN',
  name: (
    <>
      Webnua Perth · <em>productized agency</em>
    </>
  ),
  meta: (
    <>
      <strong>$497/mo</strong> base + ~<strong>$180/mo ad spend</strong> (passed through at cost)
      <br />
      Next bill: <strong>June 1, 2026</strong> · 18 days
    </>
  ),
};

export const clientBillingMethod = {
  cardIcon: 'VISA',
  name: 'Visa ending in 8821',
  meta: 'Expires 06/27 · Mark Cassidy · Voltline Pty Ltd',
};

export const clientBillingInvoices: Invoice[] = [
  {
    id: '2026-05',
    date: '01 May 2026',
    description: 'Webnua Perth · April · base + $186 ad spend',
    amount: '$683.00',
    status: 'paid',
  },
  {
    id: '2026-04',
    date: '01 Apr 2026',
    description: 'Webnua Perth · onboarding setup · prorated',
    amount: '$1,494.00',
    status: 'paid',
  },
];

export const clientBillingIncluded = [
  { item: 'Landing page', sub: 'custom + hosted' },
  { item: 'Meta ad campaign', sub: 'managed' },
  { item: '3 automations', sub: 'always-on' },
  { item: 'Review request loop' },
  { item: 'Calendar + booking system' },
  { item: 'Slack / WhatsApp support' },
];
