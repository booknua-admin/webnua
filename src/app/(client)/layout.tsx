import { AppShell } from '@/components/shared/AppShell';
import { DevRoleSwitcher } from '@/components/shared/DevRoleSwitcher';
import { ClientSidebar } from '@/components/client/ClientSidebar';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AppShell sidebar={<ClientSidebar />}>{children}</AppShell>
      <DevRoleSwitcher />
    </>
  );
}
