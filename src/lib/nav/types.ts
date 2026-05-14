import type { ReactNode } from 'react';

export type NavItem = {
  label: string;
  href: string;
  icon: ReactNode;
  badge?: { text: string; tone?: 'default' | 'muted' };
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export type SettingsNavItem = {
  label: string;
  href: string;
  icon: ReactNode;
};
