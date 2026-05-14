import type { Invoice } from '@/components/shared/settings/InvoiceList';

export const adminBillingPlan = {
  tag: '// CURRENT PLAN',
  name: (
    <>
      Operator · <em>4 clients</em>
    </>
  ),
  meta: (
    <>
      Base <strong>$79/mo</strong> + ~<strong>$56/mo usage</strong> (Twilio + Anthropic + Resend) ={' '}
      <strong>~$135 / month</strong>
      <br />
      Next bill: <strong>June 1, 2026</strong> · 18 days
    </>
  ),
};

export const adminBillingMethod = {
  cardIcon: 'VISA',
  name: 'Visa ending in 4242',
  meta: 'Expires 09/28 · Craig Fremantle · default for Webnua Perth',
};

export const adminBillingInvoices: Invoice[] = [
  {
    id: '2026-05',
    date: '01 May 2026',
    description: 'Operator plan · April usage · 4 clients',
    amount: '$148.20',
    status: 'paid',
  },
  {
    id: '2026-04',
    date: '01 Apr 2026',
    description: 'Operator plan · March usage · 3 clients',
    amount: '$112.40',
    status: 'paid',
  },
  {
    id: '2026-03',
    date: '01 Mar 2026',
    description: 'Operator plan · February usage · 3 clients',
    amount: '$105.80',
    status: 'paid',
  },
  {
    id: '2026-02',
    date: '01 Feb 2026',
    description: 'Operator plan · January usage · 2 clients',
    amount: '$93.20',
    status: 'paid',
  },
  {
    id: '2026-01',
    date: '01 Jan 2026',
    description: 'Operator plan · December usage · 2 clients',
    amount: '$89.60',
    status: 'paid',
  },
];
