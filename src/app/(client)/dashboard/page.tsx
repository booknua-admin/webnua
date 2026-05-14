import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { PagePlaceholder } from '@/components/shared/PagePlaceholder';

export default function ClientDashboardPage() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Home" />} />
      <PagePlaceholder
        eyebrow="Wednesday · client home"
        title="Morning, Mark."
        description="Your dashboard arrives in a later phase. For now this is a wiring check — the sidebar, brand and footer should all be in place."
      />
    </>
  );
}
