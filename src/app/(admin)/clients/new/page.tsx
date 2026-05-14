import { PagePlaceholder } from '@/components/shared/PagePlaceholder';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';

export default function AdminClientsNewPage() {
  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb trail={['Clients']} current="Add new" />}
      />
      <PagePlaceholder
        eyebrow="Clients · add new"
        title="Add a new client."
        description="The client onboarding flow lands here. This page exists so the all-clients screen has somewhere honest to send the add-new affordance."
      />
    </>
  );
}
