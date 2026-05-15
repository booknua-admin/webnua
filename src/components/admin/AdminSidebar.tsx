import { Sidebar } from '@/components/shared/Sidebar';
import { SidebarBrand } from '@/components/shared/SidebarBrand';
import { SidebarItem } from '@/components/shared/SidebarItem';
import { SidebarSectionLabel } from '@/components/shared/SidebarSectionLabel';
import { SidebarUser } from '@/components/shared/SidebarUser';
import { adminClients } from '@/lib/nav/admin-clients';
import {
  adminOverviewNav,
  adminUser,
  adminWorkspace,
  adminWorkspaceNav,
} from '@/lib/nav/admin-nav';

import { AdminClientPicker } from './AdminClientPicker';
import { AdminWorkspaceBlock } from './AdminWorkspaceBlock';

function AdminSidebar() {
  return (
    <Sidebar>
      <SidebarBrand meta="Operator console" />

      <SidebarSectionLabel>{adminOverviewNav.label}</SidebarSectionLabel>
      {adminOverviewNav.items.map((item) => (
        <SidebarItem key={item.href} {...item} />
      ))}

      <SidebarSectionLabel>Clients</SidebarSectionLabel>
      <AdminClientPicker clients={adminClients} />

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
