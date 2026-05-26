'use client';

import { Sidebar } from '@/components/shared/Sidebar';
import { SidebarBrand } from '@/components/shared/SidebarBrand';
import { SidebarItem } from '@/components/shared/SidebarItem';
import { SidebarSectionLabel } from '@/components/shared/SidebarSectionLabel';
import { SidebarUser } from '@/components/shared/SidebarUser';
import { useUser } from '@/lib/auth/user-stub';
import { useAdminClients } from '@/lib/clients/clients-store';
import { adminWorkspace, adminWorkspaceNav } from '@/lib/nav/admin-nav';
import { useAdminNavBadgeCounts } from '@/lib/nav/use-nav-badge-counts';

import { AdminClientPicker } from './AdminClientPicker';
import { AdminWorkspaceBlock } from './AdminWorkspaceBlock';

function initialFrom(value: string | null | undefined): string {
  const ch = (value ?? '').trim()[0];
  return ch ? ch.toUpperCase() : '·';
}

function AdminSidebar() {
  const clients = useAdminClients();
  // Operator identity resolves from the signed-in user, same as ClientSidebar
  // — never from the previous hardcoded `adminUser` constant.
  const user = useUser();
  const userName = user?.displayName ?? '…';
  const userInitial = initialFrom(user?.displayName ?? user?.email);
  // Live workspace-mode-aware counts. SidebarItem auto-hides badges with
  // text `'0'` so an empty inbox renders without an empty pill.
  const badgeCounts = useAdminNavBadgeCounts();

  return (
    <Sidebar>
      <SidebarBrand meta="Operator console" />

      <SidebarSectionLabel>Clients</SidebarSectionLabel>
      <AdminClientPicker clients={clients} />

      <SidebarSectionLabel>{adminWorkspaceNav.label}</SidebarSectionLabel>
      {adminWorkspaceNav.items.map((item) => {
        const live =
          item.href === '/leads'
            ? { ...item, badge: { text: String(badgeCounts.leads) } }
            : item.href === '/tickets'
              ? { ...item, badge: { text: String(badgeCounts.tickets) } }
              : item;
        return <SidebarItem key={item.href} {...live} />;
      })}

      <AdminWorkspaceBlock
        label={adminWorkspace.label}
        name={adminWorkspace.name}
      />

      <SidebarUser
        initial={userInitial}
        name={userName}
        role={user?.email ?? 'Operator'}
      />
    </Sidebar>
  );
}

export { AdminSidebar };
