type TeamMember = {
  id: string;
  initial: string;
  name: string;
  isYou?: boolean;
  email: string;
  role: string;
  roleSub: string;
  status: 'active' | 'pending';
  statusLabel: string;
  actions: { label: string; tone?: 'default' | 'danger' }[];
};

export const adminTeamMembers: TeamMember[] = [
  {
    id: 'craig',
    initial: 'C',
    name: 'Craig Fremantle',
    isYou: true,
    email: 'craig@webnua.io · joined Mar 2026',
    role: 'Owner',
    roleSub: 'FULL ACCESS',
    status: 'active',
    statusLabel: 'Active · 2m ago',
    actions: [{ label: 'Edit' }],
  },
  {
    id: 'raj',
    initial: 'R',
    name: 'Raj Kumar',
    email: 'raj@webnua.io · joined Apr 2026',
    role: 'Operator',
    roleSub: 'ALL CLIENTS · NO BILLING',
    status: 'active',
    statusLabel: 'Active · 1h ago',
    actions: [{ label: 'Edit' }, { label: 'Remove', tone: 'danger' }],
  },
  {
    id: 'jamie',
    initial: 'J',
    name: 'Jamie Hughes',
    email: 'jamie@webnua.io · invited 2d ago',
    role: 'Junior operator',
    roleSub: '2 CLIENTS · LIMITED',
    status: 'pending',
    statusLabel: 'Invite pending',
    actions: [{ label: 'Resend' }, { label: 'Revoke', tone: 'danger' }],
  },
];

type PermissionRow = {
  capability: string;
  sub?: string;
  owner: boolean;
  operator: boolean;
  junior: boolean;
};

export const adminTeamPermissions: PermissionRow[] = [
  {
    capability: 'View all clients',
    sub: 'Includes financials',
    owner: true,
    operator: true,
    junior: false,
  },
  {
    capability: 'Create + edit landing pages',
    owner: true,
    operator: true,
    junior: false,
  },
  {
    capability: 'Edit automations',
    sub: 'Copy + timing',
    owner: true,
    operator: true,
    junior: true,
  },
  {
    capability: 'Manage Meta ad campaigns',
    owner: true,
    operator: true,
    junior: false,
  },
  {
    capability: 'Billing + plan changes',
    owner: true,
    operator: false,
    junior: false,
  },
  {
    capability: 'Invite team members',
    owner: true,
    operator: false,
    junior: false,
  },
  {
    capability: 'Delete workspace / clients',
    owner: true,
    operator: false,
    junior: false,
  },
];
