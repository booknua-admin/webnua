'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { TicketActionRow } from '@/components/shared/tickets/TicketActionRow';
import type { TicketDetailAction } from '@/lib/tickets/client-detail';

type ConfirmAction = Extract<TicketDetailAction, { kind: 'confirm' }>;

type TicketActionListProps = {
  actions: TicketDetailAction[];
};

function TicketActionList({ actions }: TicketActionListProps) {
  const router = useRouter();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );

  return (
    <>
      {actions.map((action) => {
        if (action.kind === 'link') {
          return (
            <TicketActionRow
              key={action.label}
              icon={action.icon}
              label={action.label}
              href={action.href}
            />
          );
        }
        if (action.kind === 'confirm') {
          return (
            <TicketActionRow
              key={action.label}
              icon={action.icon}
              label={action.label}
              onClick={() => setConfirmAction(action)}
            />
          );
        }
        return (
          <TicketActionRow
            key={action.label}
            icon={action.icon}
            label={action.label}
            disabled
          />
        );
      })}
      {confirmAction && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirmAction(null);
          }}
          title={confirmAction.confirm.title}
          description={confirmAction.confirm.description}
          confirmLabel={confirmAction.confirm.confirmLabel}
          tone={confirmAction.confirm.tone}
          onConfirm={() => {
            const { thenHref } = confirmAction.confirm;
            setConfirmAction(null);
            if (thenHref) router.push(thenHref);
          }}
        />
      )}
    </>
  );
}

export { TicketActionList };
export type { TicketActionListProps };
