import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { PagePlaceholder } from '@/components/shared/PagePlaceholder';

export default function AdminTicketsPage() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Tickets" />} />
      <PagePlaceholder
        eyebrow="Tickets · inbox"
        title="Tickets."
        description="The ticket inbox lands here. This page exists so the admin nav is clickable end-to-end."
      />
    </>
  );
}
