type WorkspaceField = {
  label: string;
  sub?: string;
  value: string;
  mono?: boolean;
};

export const adminWorkspaceFields: WorkspaceField[] = [
  { label: 'Workspace name', value: 'Webnua Perth' },
  {
    label: 'Workspace ID',
    sub: 'For API + webhook routing',
    value: 'ws_perth_8f4e2a1c',
    mono: true,
  },
  {
    label: 'Default timezone',
    sub: 'For automation send times',
    value: 'Australia/Perth · AWST (+8)',
  },
  { label: 'Default currency', value: 'AUD ($)' },
];

export const adminWorkspacePlanFields: WorkspaceField[] = [
  { label: 'Plan', value: 'Operator · 4 clients' },
  {
    label: 'Monthly cost',
    sub: 'Infra + send fees · billed monthly',
    value: '~$135 / month',
  },
  { label: 'Next bill date', value: 'June 1, 2026' },
];
