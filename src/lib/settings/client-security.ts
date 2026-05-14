export const clientSecurityCredentials = [
  {
    id: 'email',
    heading: 'Email',
    status: { tone: 'verified' as const },
    description: 'mark@voltline.com.au · login + receipts go here',
    action: { label: 'Change' },
  },
  {
    id: 'password',
    heading: 'Password',
    description: 'Last changed 14 days ago · strong',
    action: { label: 'Change password' },
  },
  {
    id: 'mobile',
    heading: 'Mobile (login + SMS)',
    status: { tone: 'verified' as const },
    description: '0411 567 234 · used for 2FA codes if enabled',
    action: { label: 'Change' },
  },
];

export const clientSecurityTwoFactor = [
  {
    id: 'sms',
    heading: 'SMS codes',
    status: { tone: 'warn' as const, label: 'Recommended' },
    description: 'Receive a 6-digit code via SMS when logging in from a new device.',
    action: { label: 'Enable', variant: 'default' as const },
  },
  {
    id: 'authenticator',
    heading: 'Authenticator app',
    description:
      'Use Google Authenticator, Authy, or 1Password for time-based codes (more secure than SMS).',
    action: { label: 'Set up' },
  },
];

export const clientSecuritySessions = [
  {
    id: 'iphone',
    icon: '📱',
    device: 'iPhone 15 · Safari',
    isCurrent: true,
    meta: 'Perth, WA · 0411 567•••',
    when: 'Active now',
  },
  {
    id: 'macbook',
    icon: '💻',
    device: 'MacBook Air · Chrome',
    meta: 'Perth, WA · last seen home wifi',
    when: '2 hours ago',
  },
  {
    id: 'ipad',
    icon: '💻',
    device: 'iPad · Safari',
    meta: 'Perth, WA · van mount',
    when: 'Yesterday',
  },
];
