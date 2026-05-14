import { IntegrationMatrix } from '@/components/admin/integrations/IntegrationMatrix';
import { IntegrationMatrixActionCard } from '@/components/admin/integrations/IntegrationMatrixActionCard';
import { IntegrationMatrixHero } from '@/components/admin/integrations/IntegrationMatrixHero';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import {
  adminMatrixAttention,
  adminMatrixColumns,
  adminMatrixFilters,
  adminMatrixGaps,
  adminMatrixHero,
  adminMatrixRows,
} from '@/lib/integrations/admin-matrix';

export default function AdminIntegrationsPage() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Workspace']} current="Integrations" />} />
      <div className="flex flex-col gap-7 px-10 py-10">
        <PageHeader
          eyebrow="Workspace · cross-client"
          title={
            <>
              Client <em>integrations</em>.
            </>
          }
          subtitle={
            <>
              Every client&apos;s connection status in one view.{' '}
              <strong>Click a cell to drop into that client&apos;s admin view</strong> — or use the
              action panels below to nudge clients on the missing pieces.
            </>
          }
        />

        <IntegrationMatrixHero
          tag={adminMatrixHero.tag}
          title={adminMatrixHero.title}
          subtitle={adminMatrixHero.subtitle}
          stats={adminMatrixHero.stats}
        />

        <IntegrationMatrix
          title={
            <>
              Integration <em>matrix</em> · {adminMatrixRows.length} clients ×{' '}
              {adminMatrixColumns.length} integrations
            </>
          }
          filters={adminMatrixFilters}
          activeFilter="all"
          columns={adminMatrixColumns}
          rows={adminMatrixRows}
        />

        <div className="grid grid-cols-2 gap-3.5">
          <IntegrationMatrixActionCard
            tone="attention"
            heading="Needs your attention"
            badge={{ label: String(adminMatrixAttention.length), tone: 'warn' }}
            description={
              <>
                Token expired or connection broken.{' '}
                <strong>Trigger a reauth request to the client</strong> — they&apos;ll get a
                notification.
              </>
            }
            items={adminMatrixAttention}
          />
          <IntegrationMatrixActionCard
            heading="Critical gaps"
            badge={{ label: String(adminMatrixGaps.length), tone: 'info' }}
            description={
              <>
                Missing integrations that block a service from working.{' '}
                <strong>Send a setup nudge</strong> with a one-click connect link.
              </>
            }
            items={adminMatrixGaps}
          />
        </div>
      </div>
    </>
  );
}
