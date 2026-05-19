'use client';

import { Sidebar } from '@/components/shared/Sidebar';
import { SidebarBrand } from '@/components/shared/SidebarBrand';
import { SidebarItem } from '@/components/shared/SidebarItem';
import { SidebarSectionLabel } from '@/components/shared/SidebarSectionLabel';
import { SidebarUser } from '@/components/shared/SidebarUser';
import { useAdminClients } from '@/lib/clients/clients-store';
import { adminUser, adminWorkspace, adminWorkspaceNav } from '@/lib/nav/admin-nav';

import { AdminClientPicker } from './AdminClientPicker';
import { AdminWorkspaceBlock } from './AdminWorkspaceBlock';

function AdminSidebar() {
  const clients = useAdminClients();

  return (
    <Sidebar>
      <SidebarBrand meta="Operator console" />

      <SidebarSectionLabel>Clients</SidebarSectionLabel>
      <AdminClientPicker clients={clients} />

      <SidebarSectionLabel>{adminWorkspaceNav.label}</SidebarSectionLabel>
      {adminWorkspaceNav.items.map((item) => (
        <SidebarItem key={item.href} {...item} />
      ))}

      <AdminWorkspaceBlock
        label={adminWorkspace.label}
        name={adminWorkspace.name}
      />

      <SidebarUser
        initial={adminUser.initial}
        name={adminUser.name}
        role={adminUser.role}
      />
    </Sidebar>
  );
}

export { AdminSidebar };
