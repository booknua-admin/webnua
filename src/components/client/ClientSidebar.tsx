'use client';

// =============================================================================
// ClientSidebar — the client-role sidebar.
//
// Identity is resolved at render time from the signed-in user (useUser) + the
// clients-store (useAdminClients) — NEVER from hardcoded constants. See the
// onboarding audit §3b: a client seeing someone else's business name in their
// own dashboard is the single most credibility-destroying bug in the product.
//
// Hydration: `useUser()` and `useAdminClients()` both go through real Supabase
// reads. While they resolve we render the chrome with neutral placeholder
// values — never a real-looking but wrong identity.
// =============================================================================

import { Sidebar } from '@/components/shared/Sidebar';
import { SidebarBrand } from '@/components/shared/SidebarBrand';
import { SidebarItem } from '@/components/shared/SidebarItem';
import { SidebarSectionLabel } from '@/components/shared/SidebarSectionLabel';
import { SidebarUser } from '@/components/shared/SidebarUser';
import { useUser } from '@/lib/auth/user-stub';
import { useAdminClients } from '@/lib/clients/clients-store';
import { clientNav, clientSupportContact } from '@/lib/nav/client-nav';
import { useClientNavBadgeCounts } from '@/lib/nav/use-nav-badge-counts';

import { ClientSupportCard } from './ClientSupportCard';
import { ClientWorkspaceCard } from './ClientWorkspaceCard';

/** First non-whitespace character, uppercased — falls back to "·" so the
 *  initial slot is never blank while hydration is in flight. */
function initialFrom(value: string | null | undefined): string {
  const ch = (value ?? '').trim()[0];
  return ch ? ch.toUpperCase() : '·';
}

/** A label for the user footer's secondary line. Email is the right call here:
 *  the User type carries no team_role today and we will not invent one (the
 *  parked Q6 decision — simple "Active" status, no fake "Owner" titles). The
 *  email also doubles as a "which account am I signed into" reassurance. */
function userRoleLabel(email: string | null | undefined): string {
  return email ?? 'Account';
}

function ClientSidebar() {
  const user = useUser();
  const clients = useAdminClients();
  // Live unread-leads + tickets-awaiting-your-reply counts. SidebarItem
  // auto-hides badges with text '0' so a quiet inbox renders no pill.
  const badgeCounts = useClientNavBadgeCounts();

  // The signed-in client's workspace. `user.clientId` is the client slug
  // (matches `AdminClient.id`); resolve to the row so we have the live name.
  const client = user?.clientId
    ? (clients.find((c) => c.id === user.clientId) ?? null)
    : null;

  const workspaceName = client?.name ?? '…';
  const workspaceInitial = initialFrom(client?.name);
  const userName = user?.displayName ?? '…';
  const userInitial = initialFrom(user?.displayName ?? user?.email);

  return (
    <Sidebar>
      <SidebarBrand meta="Client workspace" />

      <ClientWorkspaceCard
        initial={workspaceInitial}
        name={workspaceName}
        status="Active"
      />

      {clientNav.map((section) => (
        <div key={section.label}>
          <SidebarSectionLabel>{section.label}</SidebarSectionLabel>
          {section.items.map((item) => {
            const live =
              item.href === '/leads'
                ? { ...item, badge: { text: String(badgeCounts.leads) } }
                : item.href === '/tickets'
                  ? { ...item, badge: { text: String(badgeCounts.tickets) } }
                  : item;
            return <SidebarItem key={item.href} {...live} />;
          })}
        </div>
      ))}

      <ClientSupportCard contact={clientSupportContact} />

      <SidebarUser
        initial={userInitial}
        name={userName}
        role={userRoleLabel(user?.email)}
      />
    </Sidebar>
  );
}

export { ClientSidebar };
