'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { AutomationActionCard } from '@/components/admin/automations/AutomationActionCard';
import { AutomationAddActionMenu } from '@/components/admin/automations/AutomationAddActionMenu';
import { AutomationCloneButton } from '@/components/admin/automations/AutomationCloneButton';
import { AutomationEditorLayout } from '@/components/admin/automations/AutomationEditorLayout';
import { AutomationRunsCard } from '@/components/admin/automations/AutomationRunsCard';
import { AutomationStatsRailCard } from '@/components/admin/automations/AutomationStatsRailCard';
import { AutomationStepConnector } from '@/components/admin/automations/AutomationStepConnector';
import { AutomationTestSendCard } from '@/components/admin/automations/AutomationTestSendCard';
import { AutomationTriggerBox } from '@/components/admin/automations/AutomationTriggerBox';
import { AutomationTriggerEditor } from '@/components/admin/automations/AutomationTriggerEditor';
import { useAutomationGbpGuard } from '@/components/shared/automations/AutomationGbpGuard';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EditorFooterActions } from '@/components/shared/EditorFooterActions';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { useRole } from '@/lib/auth/user-stub';
import {
  useAddAction,
  useAutomationActiveRuns,
  useAutomationEditor,
  useMoveAction,
  useRemoveAction,
  useToggleAutomation,
  useUpdateActionBody,
  useUpdateActionConfig,
  useUpdateAutomationTrigger,
} from '@/lib/automations/queries';
import type {
  AutomationEditableTriggerField,
  AutomationEditor,
  AutomationEditorAction,
  AutomationEditorActionType,
} from '@/lib/automations/types';
import { normalizeError } from '@/lib/errors';

export default function AutomationEditorPage() {
  const { role, hydrated } = useRole();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '');

  // Phase 8 Session 2: client-role users can reach the editor (read-only view);
  // operators get full edit. Role resolution gates the inner mount.
  const { data: editor, isLoading, error } = useAutomationEditor(id ?? '');

  if (!hydrated) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-paper">
        <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {'// Resolving role…'}
        </div>
      </div>
    );
  }

  const isOperator = role === 'admin';

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb
            trail={[isOperator ? 'Workspace' : 'Home', 'Automations']}
            current="Edit flow"
          />
        }
      />
      <div className="flex flex-col px-4 py-6 md:px-10 md:py-10">
        {isLoading ? (
          <EditorNotice>{'// Loading automation…'}</EditorNotice>
        ) : error || !editor ? (
          <EditorNotice>
            {`// ${error ? normalizeError(error).message : 'Automation not found'}`}
          </EditorNotice>
        ) : (
          <EditorBody key={editor.id} editor={editor} isOperator={isOperator} />
        )}
      </div>
    </>
  );
}

/** The editor body. Operator-edit and client-read use the same shape; the
 *  per-card / per-mutation surfaces honour the `readOnly` prop where wired,
 *  and the operator-only affordances (add / remove / reorder / clone, trigger
 *  edits) are conditionally rendered. */
function EditorBody({
  editor,
  isOperator,
}: {
  editor: AutomationEditor;
  isOperator: boolean;
}) {
  // -- Trigger local state (operator-side dirty/save flow) ----------
  // Filter fields (requires_phone / _email / _gbp_location) are NOT exposed
  // as toggles in the UI — they're system invariants enforced at runtime.
  // We still persist the existing `trigger_filters` jsonb on save so any
  // legacy value the row carries is preserved (not clobbered).
  const [triggerFields, setTriggerFields] = useState(editor.triggerFields);
  const [triggerDirty, setTriggerDirty] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setTriggerFields(editor.triggerFields);
    setTriggerDirty(false);
  }, [editor]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // -- Mutations -------------------------------------------------------------
  const addAction = useAddAction();
  const moveAction = useMoveAction();
  const removeAction = useRemoveAction();
  const updateBody = useUpdateActionBody();
  const updateConfig = useUpdateActionConfig();
  const updateTrigger = useUpdateAutomationTrigger();
  const toggle = useToggleAutomation();
  const { guardEnable, GbpGuardDialog } = useAutomationGbpGuard();
  const { data: activeRunCount = 0 } = useAutomationActiveRuns(editor.id);

  // Trigger filters carry the GBP prereq the toggle guard reads. The editor's
  // `editor.filterFields` shape preserves the requires_gbp_location flag from
  // the join.
  const requiresGbpLocation = editor.filterFields.some(
    (f) => f.kind === 'requires_gbp_location' && f.value === true,
  );

  // -- Per-action UI state ---------------------------------------------------
  const [pendingRemoval, setPendingRemoval] =
    useState<AutomationEditorAction | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // -- Per-action handlers ---------------------------------------------------
  const handleBodyChange = (
    actionId: string,
    body: string,
    subject: string | null,
  ) => {
    setStatusMessage(null);
    updateBody.mutate(
      { actionId, body, subject },
      {
        onError: (err) =>
          setStatusMessage(`Save failed — ${normalizeError(err).message}`),
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
        onError: (err) =>
          setStatusMessage(`Save failed — ${normalizeError(err).message}`),
        onSuccess: () => setStatusMessage('Saved'),
      },
    );
  };

  const handleMove = (actionId: string, direction: 'up' | 'down') => {
    moveAction.mutate(
      { actionId, direction },
      {
        onError: (err) =>
          setStatusMessage(`Move failed — ${normalizeError(err).message}`),
      },
    );
  };

  const handleAdd = (actionType: AutomationEditorActionType) => {
    addAction.mutate(
      { automationId: editor.id, actionType },
      {
        onError: (err) =>
          setStatusMessage(`Add failed — ${normalizeError(err).message}`),
      },
    );
  };

  const handleRemoveConfirmed = (action: AutomationEditorAction) => {
    removeAction.mutate(
      { actionId: action.id },
      {
        onError: (err) =>
          setStatusMessage(`Delete failed — ${normalizeError(err).message}`),
        onSuccess: () => setStatusMessage('Action removed'),
      },
    );
    setPendingRemoval(null);
  };

  // -- Trigger handlers ------------------------------------------------------
  const patchTrigger = (next: AutomationEditableTriggerField) => {
    setTriggerFields((current) =>
      current.map((f) => (f.kind === next.kind ? next : f)),
    );
    setTriggerDirty(true);
  };

  const handleSaveTrigger = async () => {
    if (!triggerDirty) return;
    try {
      await updateTrigger.mutateAsync({
        id: editor.id,
        patch: {
          triggerConfig: buildTriggerConfigPayload(triggerFields),
          // Preserve the existing trigger_filters jsonb as-is — the UI no
          // longer exposes `requires_*` checkboxes, but the row's stored
          // filters drive the runtime engine and must persist.
          triggerFilters: buildTriggerFiltersPayloadFromEditor(editor.filterFields),
        },
      });
      setStatusMessage('Trigger saved');
    } catch (err) {
      setStatusMessage(`Save failed — ${normalizeError(err).message}`);
    }
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
      {!isOperator ? (
        <div className="mb-5 rounded-md border border-info/40 bg-info/8 px-4 py-3 font-sans text-[13px] text-ink">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-info">
            {'// View only'}
          </span>{' '}
          Webnua manages this automation&rsquo;s copy. You can pause it from
          the toggle below; <strong>copy changes go through your operator</strong>
          .
        </div>
      ) : null}
      {isOperator ? (
        <div className="mb-4 flex items-center justify-end gap-2">
          <AutomationCloneButton
            automationId={editor.id}
            sourceName={editor.clientName}
            visible={isOperator}
          />
        </div>
      ) : null}
      <AutomationEditorLayout
        canvas={
          <>
            {activeRunCount > 0 ? (
              <p className="mb-4 rounded-md border border-rust-soft bg-rust-soft/30 px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ink-soft">
                {`// ${activeRunCount} active ${
                  activeRunCount === 1 ? 'run' : 'runs'
                } — they'll finish with the previous sequence`}
              </p>
            ) : null}
            <AutomationTriggerBox trigger={editor.trigger} />
            <AutomationTriggerEditor
              triggerFields={triggerFields}
              onChangeTrigger={patchTrigger}
              readOnly={!isOperator}
            />
            {isOperator && triggerDirty ? (
              <div className="mt-2 flex justify-end">
                <Button
                  variant="secondary"
                  onClick={handleSaveTrigger}
                  disabled={updateTrigger.isPending}
                >
                  {updateTrigger.isPending ? 'Saving trigger…' : 'Save trigger'}
                </Button>
              </div>
            ) : null}
            {actions.map((action, index) => (
              <div key={action.id}>
                <AutomationStepConnector />
                <AutomationActionCard
                  action={action}
                  isFirst={index === 0}
                  isLast={index === actions.length - 1}
                  variables={variableItems}
                  readOnly={!isOperator}
                  onMove={(direction) => handleMove(action.id, direction)}
                  onRemove={() => setPendingRemoval(action)}
                  onChange={(change) => {
                    if (change.kind === 'body') {
                      handleBodyChange(
                        action.id,
                        change.body,
                        change.subject ?? null,
                      );
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
            {isOperator ? (
              <div className="mt-5">
                <AutomationAddActionMenu
                  onPick={handleAdd}
                  disabled={addAction.isPending}
                  currentCount={actions.length}
                />
              </div>
            ) : null}
          </>
        }
        rail={
          <>
            {isOperator ? (
              <AutomationTestSendCard
                heading={editor.rail.testSend.heading}
                body={editor.rail.testSend.body}
                buttonLabel={editor.rail.testSend.buttonLabel}
                data={editor.testSend}
                clientId={editor.clientId}
                actions={actions}
              />
            ) : null}
            <AutomationStatsRailCard automationId={editor.id} />
            <AutomationRunsCard automationId={editor.id} limit={20} />
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
              onClick={() => {
                const nextEnabled = !editor.enabled;
                const fire = () =>
                  toggle.mutate({ id: editor.id, enabled: nextEnabled });
                if (nextEnabled) {
                  guardEnable(
                    {
                      clientId: editor.clientId,
                      requiresGbpLocation,
                    },
                    fire,
                  );
                } else {
                  fire();
                }
              }}
            >
              {editor.footer.disableLabel}
            </Button>
          </>
        }
      />

      <GbpGuardDialog />

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

// --- Trigger config / filter payload builders -----------------------------

function buildTriggerConfigPayload(
  fields: AutomationEditableTriggerField[],
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const f of fields) {
    if (
      f.kind === 'delay_minutes' ||
      f.kind === 'days_after_last_outbound' ||
      f.kind === 'max_nudges'
    ) {
      payload[f.kind] = f.value;
    } else if (f.kind === 'to_status') {
      payload[f.kind] = f.value;
    }
  }
  return payload;
}

/**
 * Build the `trigger_filters` jsonb from the editor's filter-fields snapshot.
 * The filter checkboxes are no longer UI-editable (system invariants), but the
 * row's stored filters must persist on save so a save of an unrelated cadence
 * field doesn't clobber `requires_gbp_location` etc.
 */
function buildTriggerFiltersPayloadFromEditor(
  fields: AutomationEditor['filterFields'],
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.value) payload[f.kind] = true;
  }
  return payload;
}
