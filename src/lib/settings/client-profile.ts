type ProfileField = {
  label: string;
  sub?: string;
  value: string;
  action?: string;
};

export const clientProfileBusiness: ProfileField[] = [
  { label: 'Business name', value: 'Voltline Pty Ltd', action: 'Request change ✎' },
  { label: 'Owner', value: 'Mark Cassidy', action: 'Edit ✎' },
  {
    label: 'Mobile',
    sub: 'Used for SMS replies + login',
    value: '0411 567 234',
    action: 'Edit ✎',
  },
  { label: 'Email', value: 'mark@voltline.com.au', action: 'Edit ✎' },
  {
    label: 'Service area',
    value: 'Perth metro · north of river',
    action: 'Request change ✎',
  },
  {
    label: 'Licence',
    sub: 'Shown on your funnel + invoices',
    value: 'EC Lic 47829 · $20M PL',
    action: 'Request change ✎',
  },
];

export const clientProfileManagedByWebnua: ProfileField[] = [
  {
    label: 'Landing page',
    sub: 'Copy, design, offers, jobs menu',
    value: 'voltline.com.au · v3 · live',
  },
  {
    label: 'Meta ads',
    sub: 'Creatives, audiences, budgets',
    value: '$40/day · running',
  },
  {
    label: 'Automations',
    sub: 'Copy, timing, sequences',
    value: '3 active · 1 off',
  },
  { label: 'Plan', value: 'Webnua Perth · $497/mo + ad spend' },
];
