'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { AutomationActionCard } from '@/components/admin/automations/AutomationActionCard';
import { AutomationAddActionMenu } from '@/components/admin/automations/AutomationAddActionMenu';
import { AutomationEditorLayout } from '@/components/admin/automations/AutomationEditorLayout';
import { AutomationPerformanceCard } from '@/components/admin/automations/AutomationPerformanceCard';
import { AutomationStepConnector } from '@/components/admin/automations/AutomationStepConnector';
import { AutomationTestSendCard } from '@/components/admin/automations/AutomationTestSendCard';
import { AutomationTriggerBox } from '@/components/admin/automations/AutomationTriggerBox';
import { AutomationVariableList } from '@/components/admin/automations/AutomationVariableList';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EditorFooterActions } from '@/components/shared/EditorFooterActions';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import {
  useAddAction,
  useAutomationActiveRuns,
  useAutomationEditor,
  useMoveAction,
  useRemoveAction,
  useToggleAutomation,
  useUpdateActionBody,
  useUpdateActionConfig,
} from '@/lib/automations/queries';
import type {
  AutomationEditor,
  AutomationEditorAction,
  AutomationEditorActionType,
} from '@/lib/automations/types';
import { useRole } from '@/lib/auth/user-stub';
import { normalizeError } from '@/lib/errors';

export default function AutomationEditorPage() {
  const { role, hydrated } = useRole();
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '');

  useEffect(() => {
    if (hydrated && role === 'client') router.replace('/automations');
  }, [hydrated, role, router]);

  const { data: editor, isLoading, error } = useAutomationEditor(id ?? '');

  if (!hydrated || role !== 'admin') {
    return (
      <div className="flex min-h-svh items-center justify-center bg-paper">
        <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {'// Resolving role…'}
        </div>
      </div>
    );
  }

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb
            trail={['Workspace', 'Automations']}
            current="Edit flow"
          />
        }
      />
      <div className="flex flex-col px-10 py-10">
        {isLoading ? (
          <EditorNotice>{'// Loading automation…'}</EditorNotice>
        ) : error || !editor ? (
          <EditorNotice>
            {`// ${error ? normalizeError(error).message : 'Automation not found'}`}
          </EditorNotice>
        ) : (
          <EditorBody key={editor.id} editor={editor} />
        )}
      </div>
    </>
  );
}

function EditorBody({ editor }: { editor: AutomationEditor }) {
  const addAction = useAddAction();
  const moveAction = useMoveAction();
  const removeAction = useRemoveAction();
  const updateBody = useUpdateActionBody();
  const updateConfig = useUpdateActionConfig();
  const toggle = useToggleAutomation();
  const { data: activeRunCount = 0 } = useAutomationActiveRuns(editor.id);

  const [pendingRemoval, setPendingRemoval] =
    useState<AutomationEditorAction | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleBodyChange = (
    actionId: string,
    body: string,
    subject: string | null,
  ) => {
    setStatusMessage(null);
    updateBody.mutate(
      { actionId, body, subject },
      {
        onError: (err) => setStatusMessage(`Save failed — ${normalizeError(err).message}`),
        onSuccess: () => setStatusMessage('Saved'),
      },
    );
  };

  const handleConfigChange = (
    actionId: string,
    config: Record<string, unknown>,
  ) => {
    setStatusMessage(null);
    updateConfig.mutate(
      { actionId, config },
      {
        onError: (err) => setStatusMessage(`Save failed — ${normalizeError(err).message}`),
        onSuccess: () => setStatusMessage('Saved'),
      },
    );
  };

  const handleMove = (actionId: string, direction: 'up' | 'down') => {
    moveAction.mutate(
      { actionId, direction },
      {
        onError: (err) => setStatusMessage(`Move failed — ${normalizeError(err).message}`),
      },
    );
  };

  const handleAdd = (actionType: AutomationEditorActionType) => {
    addAction.mutate(
      { automationId: editor.id, actionType },
      {
        onError: (err) => setStatusMessage(`Add failed — ${normalizeError(err).message}`),
      },
    );
  };

  const handleRemoveConfirmed = (action: AutomationEditorAction) => {
    removeAction.mutate(
      { actionId: action.id },
      {
        onError: (err) => setStatusMessage(`Delete failed — ${normalizeError(err).message}`),
        onSuccess: () => setStatusMessage('Action removed'),
      },
    );
    setPendingRemoval(null);
  };

  const actions = editor.actions ?? [];
  const variableItems = editor.rail.variables.items;

  return (
    <>
      <PageHeader
        eyebrow={editor.eyebrow}
        title={editor.title}
        subtitle={editor.subtitle}
      />
      <AutomationEditorLayout
        canvas={
          <>
            {activeRunCount > 0 ? (
              <p className="mb-4 rounded-md border border-rust-soft bg-rust-soft/30 px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ink-soft">
                {`// ${activeRunCount} active ${activeRunCount === 1 ? 'run' : 'runs'} — they'll finish with the previous sequence`}
              </p>
            ) : null}
            <AutomationTriggerBox trigger={editor.trigger} />
            {actions.map((action, index) => (
              <div key={action.id}>
                <AutomationStepConnector />
                <AutomationActionCard
                  action={action}
                  isFirst={index === 0}
                  isLast={index === actions.length - 1}
                  variables={variableItems}
                  onMove={(direction) => handleMove(action.id, direction)}
                  onRemove={() => setPendingRemoval(action)}
                  onChange={(change) => {
                    if (change.kind === 'body') {
                      handleBodyChange(action.id, change.body, change.subject ?? null);
                    } else {
                      handleConfigChange(action.id, change.config);
                    }
                  }}
                  saving={
                    (updateBody.isPending &&
                      updateBody.variables?.actionId === action.id) ||
                    (updateConfig.isPending &&
                      updateConfig.variables?.actionId === action.id) ||
                    (moveAction.isPending &&
                      moveAction.variables?.actionId === action.id) ||
                    (removeAction.isPending &&
                      removeAction.variables?.actionId === action.id)
                  }
                />
              </div>
            ))}
            {actions.length === 0 ? (
              <p className="mt-4 rounded-md border border-dashed border-rule bg-paper px-5 py-6 text-center font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
                {'// This automation has no actions yet — add one below'}
              </p>
            ) : null}
            <div className="mt-5">
              <AutomationAddActionMenu
                onPick={handleAdd}
                disabled={addAction.isPending}
              />
            </div>
          </>
        }
        rail={
          <>
            <AutomationVariableList
              heading={editor.rail.variables.heading}
              items={variableItems}
            />
            <AutomationTestSendCard
              heading={editor.rail.testSend.heading}
              body={editor.rail.testSend.body}
              buttonLabel={editor.rail.testSend.buttonLabel}
              data={editor.testSend}
            />
            <AutomationPerformanceCard
              heading={editor.rail.performance.heading}
              metrics={editor.rail.performance.metrics}
            />
          </>
        }
      />
      <EditorFooterActions
        progress={
          statusMessage ? (
            <>
              {editor.footer.progress} · <strong>{statusMessage}</strong>
            </>
          ) : (
            editor.footer.progress
          )
        }
        actions={
          <>
            <Button variant="ghost" asChild>
              <Link href={editor.footer.backHref}>
                {editor.footer.backLabel}
              </Link>
            </Button>
            <Button
              variant="secondary"
              disabled={toggle.isPending}
              onClick={() =>
                toggle.mutate({ id: editor.id, enabled: !editor.enabled })
              }
            >
              {editor.footer.disableLabel}
            </Button>
          </>
        }
      />

      <ConfirmDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemoval(null);
        }}
        title={`Remove action ${pendingRemoval?.position ?? ''}?`}
        description="The remaining actions will renumber. In-flight runs walk the sequence as it was when they started — removing the action only affects runs triggered after this edit."
        confirmLabel="Remove action"
        cancelLabel="Keep it"
        tone="destructive"
        onConfirm={() => {
          if (pendingRemoval) handleRemoveConfirmed(pendingRemoval);
        }}
      />
    </>
  );
}

function EditorNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-rule bg-card px-10 py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
      {children}
    </p>
  );
}
