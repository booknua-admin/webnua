'use client';

import { useRole } from '@/lib/auth/role-stub';

import { AdminBookingDetailContent } from './_admin-content';
import { ClientBookingDetailContent } from './_client-content';

export default function BookingDetailPage() {
  const { role } = useRole();
  if (role === 'admin') return <AdminBookingDetailContent />;
  return <ClientBookingDetailContent />;
}
