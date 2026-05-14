import { PagePlaceholder } from '@/components/shared/PagePlaceholder';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';

export default function NewTicketPage() {
  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Home', 'Tickets']} current="New" />
        }
      />
      <PagePlaceholder
        eyebrow="Tickets · submit"
        title="New ticket."
        description="The submit-a-ticket form arrives in a follow-up session. This route exists so the inbox CTA is clickable end-to-end."
      />
    </>
  );
}
