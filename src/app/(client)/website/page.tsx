import { PagePlaceholder } from '@/components/shared/PagePlaceholder';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';

export default function ClientWebsitePage() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Website" />} />
      <PagePlaceholder
        eyebrow="website overview"
        title="Your website + funnel"
        description="The full website overview — page grid with thumbnails, performance snapshot and the request-change flow — arrives in a later session. The funnel detail is already live: open /website/funnels/emergency-call-out to see it."
      />
    </>
  );
}
