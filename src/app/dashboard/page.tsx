'use client';

import { useRole } from '@/lib/auth/user-stub';

import { AdminDashboardContent } from './_admin-content';
import { ClientDashboardContent } from './_client-content';

export default function DashboardPage() {
  const { role } = useRole();
  if (role === 'admin') return <AdminDashboardContent />;
  return <ClientDashboardContent />;
}
