// adminTeamMembers (a hardcoded Craig/Raj/Jamie list) lived here through the
// stub era. The operator `/settings/team` agency view now reads real users
// from `lib/auth/roster-store` filtered to admin-role — see that consumer.
// This file keeps only the permissions matrix below, which IS reference data.

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
