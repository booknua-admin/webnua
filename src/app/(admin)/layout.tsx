import { AppShell } from '@/components/shared/AppShell';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AppShell sidebar={<AdminSidebar />}>{children}</AppShell>
    </>
  );
}
