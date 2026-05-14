'use client';

import { useRole } from '@/lib/auth/role-stub';

import { AdminLeadConversationContent } from './_admin-content';
import { ClientLeadConversationContent } from './_client-content';

export default function LeadConversationPage() {
  const { role } = useRole();
  if (role === 'admin') return <AdminLeadConversationContent />;
  return <ClientLeadConversationContent />;
}
