import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { PagePlaceholder } from '@/components/shared/PagePlaceholder';

export default function AdminClientsPage() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Clients" />} />
      <PagePlaceholder
        eyebrow="Webnua · 4 clients"
        title="Your clients."
        description="The operator dashboard lands here. This is the admin shell wiring — sidebar, client picker, workspace block all visible."
      />
    </>
  );
}
