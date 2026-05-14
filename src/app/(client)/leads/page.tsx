import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { PagePlaceholder } from '@/components/shared/PagePlaceholder';

export default function ClientLeadsPage() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Leads" />} />
      <PagePlaceholder
        eyebrow="Leads · inbox"
        title="Leads."
        description="The lead inbox lands here. This page exists so the client nav is clickable end-to-end."
      />
    </>
  );
}
