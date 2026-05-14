import { Sidebar } from '@/components/shared/Sidebar';
import { SidebarBrand } from '@/components/shared/SidebarBrand';
import { SidebarItem } from '@/components/shared/SidebarItem';
import { SidebarSectionLabel } from '@/components/shared/SidebarSectionLabel';
import { SidebarUser } from '@/components/shared/SidebarUser';
import {
  clientNav,
  clientSupport,
  clientUser,
  clientWorkspace,
} from '@/lib/nav/client-nav';

import { ClientSupportCard } from './ClientSupportCard';
import { ClientWorkspaceCard } from './ClientWorkspaceCard';

function ClientSidebar() {
  return (
    <Sidebar>
      <SidebarBrand meta="Client workspace" />

      <ClientWorkspaceCard
        initial={clientWorkspace.initial}
        name={clientWorkspace.name}
        status={clientWorkspace.status}
      />

      {clientNav.map((section) => (
        <div key={section.label}>
          <SidebarSectionLabel>{section.label}</SidebarSectionLabel>
          {section.items.map((item) => (
            <SidebarItem key={item.href} {...item} />
          ))}
        </div>
      ))}

      <ClientSupportCard contact={clientSupport} />

      <SidebarUser
        initial={clientUser.initial}
        name={clientUser.name}
        role={clientUser.role}
      />
    </Sidebar>
  );
}

export { ClientSidebar };
