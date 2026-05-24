'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { AutomationAddStep } from '@/components/admin/automations/AutomationAddStep';
import { AutomationCloneButton } from '@/components/admin/automations/AutomationCloneButton';
import { AutomationEditorLayout } from '@/components/admin/automations/AutomationEditorLayout';
import {
  AutomationEditorStep,
  type AutomationStepPatch,
} from '@/components/admin/automations/AutomationEditorStep';
import { AutomationRunsCard } from '@/components/admin/automations/AutomationRunsCard';
import { AutomationStatsRailCard } from '@/components/admin/automations/AutomationStatsRailCard';
import { AutomationStepConnector } from '@/components/admin/automations/AutomationStepConnector';
import { AutomationTestSendCard } from '@/components/admin/automations/AutomationTestSendCard';
import {
  AutomationTriggerEditor,
} from '@/components/admin/automations/AutomationTriggerEditor';
import { AutomationTriggerBox } from '@/components/admin/automations/AutomationTriggerBox';
import { AutomationVariableList } from '@/components/admin/automations/AutomationVariableList';
import { EditorFooterActions } from '@/components/shared/EditorFooterActions';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { useRole } from '@/lib/auth/user-stub';
import {
  useAutomationEditor,
  useToggleAutomation,
  useUpdateAutomationAction,
  useUpdateAutomationTrigger,
  type AutomationActionPatch,
} from '@/lib/automations/queries';
import type {
  AutomationEditableFilterField,
  AutomationEditableTriggerField,
  AutomationEditor,
  AutomationEditorStep as AutomationEditorStepData,
} from '@/lib/automations/types';
import { normalizeError } from '@/lib/errors';

export default function AutomationEditorPage() {
  const { role, hydrated } = useRole();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '');

  // Phase 8 Session 2: client-role users can now reach the editor too — they
  // see a read-only view. Operators get full edit capabilities. The role
  // resolution is done before the editor mounts so the inner page knows.
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
      <div className="flex flex-col px-10 py-10">
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

/** The editor body owns the editable step + trigger state (keyed by
 *  automation id, so switching automations remounts it with fresh state).
 *  Client-role users see the same UI in read-only mode. */
function EditorBody({
  editor,
  isOperator,
}: {
  editor: AutomationEditor;
  isOperator: boolean;
}) {
  const [steps, setSteps] = useState(editor.steps);
  const [triggerFields, setTriggerFields] = useState(editor.triggerFields);
  const [filterFields, setFilterFields] = useState(editor.filterFields);
  const [dirtyStepIds, setDirtyStepIds] = useState<Set<string>>(new Set());
  const [triggerDirty, setTriggerDirty] = useState(false);

  // When the editor fetch refreshes (after a save), re-seed the local state
  // from the freshly-fetched data. Keyed-by-id outer mount handles initial
  // load; this effect handles post-save invalidation when the row updates
  // in place. Intentional "sync local edits with refreshed server state"
  // pattern; a useReducer would be more ceremony for the same result.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setSteps(editor.steps);
    setTriggerFields(editor.triggerFields);
    setFilterFields(editor.filterFields);
    setDirtyStepIds(new Set());
    setTriggerDirty(false);
  }, [editor]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const updateAction = useUpdateAutomationAction();
  const updateTrigger = useUpdateAutomationTrigger();
  const toggle = useToggleAutomation();

  const patchStep = (stepId: string, patch: AutomationStepPatch) => {
    setSteps((current) =>
      current.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
    );
    setDirtyStepIds((current) => new Set(current).add(stepId));
  };

  const patchTrigger = (next: AutomationEditableTriggerField) => {
    setTriggerFields((current) =>
      current.map((f) => (f.kind === next.kind ? next : f)),
    );
    setTriggerDirty(true);
  };

  const patchFilter = (next: AutomationEditableFilterField) => {
    setFilterFields((current) =>
      current.map((f) => (f.kind === next.kind ? next : f)),
    );
    setTriggerDirty(true);
  };

  const isDirty = dirtyStepIds.size > 0 || triggerDirty;
  const canSave = isOperator && isDirty && !updateAction.isPending && !updateTrigger.isPending;

  const handleSave = async () => {
    // 1) Per-action body / subject / body_html / body_text patches.
    const dirtySteps = steps.filter((s) => dirtyStepIds.has(s.id));
    for (const step of dirtySteps) {
      const patch = buildActionPatch(step);
      if (Object.keys(patch).length === 0) continue;
      await updateAction.mutateAsync({ actionId: step.id, patch });
    }

    // 2) Trigger config + filters.
    if (triggerDirty) {
      await updateTrigger.mutateAsync({
        id: editor.id,
        patch: {
          triggerConfig: buildTriggerConfigPayload(triggerFields),
          triggerFilters: buildTriggerFiltersPayload(filterFields),
        },
      });
    }
  };

  const lastError = updateAction.error ?? updateTrigger.error;

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
      <div className="mb-4 flex items-center justify-end gap-2">
        <AutomationCloneButton
          automationId={editor.id}
          sourceName={editor.clientName}
          visible={isOperator}
        />
      </div>
      <AutomationEditorLayout
        canvas={
          <>
            <AutomationTriggerBox trigger={editor.trigger} />
            <AutomationTriggerEditor
              triggerFields={triggerFields}
              filterFields={filterFields}
              onChangeTrigger={patchTrigger}
              onChangeFilter={patchFilter}
              readOnly={!isOperator}
            />
            {steps.map((step) => (
              <div key={step.id}>
                <AutomationStepConnector />
                <AutomationEditorStep
                  step={step}
                  onChange={(patch) => patchStep(step.id, patch)}
                  readOnly={!isOperator}
                />
              </div>
            ))}
            <div className="mt-5">
              <AutomationAddStep label={editor.addStepLabel} />
              <p className="mt-2 px-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
                {`// Add / reorder / remove actions is planned for V1.1. ` +
                  `Open a ticket if you need a new action right now.`}
              </p>
            </div>
          </>
        }
        rail={
          <>
            <AutomationVariableList
              heading={editor.rail.variables.heading}
              items={editor.rail.variables.items}
            />
            <AutomationTestSendCard
              heading={editor.rail.testSend.heading}
              body={editor.rail.testSend.body}
              buttonLabel={editor.rail.testSend.buttonLabel}
              data={editor.testSend}
            />
            <AutomationStatsRailCard automationId={editor.id} />
            <AutomationRunsCard automationId={editor.id} limit={20} />
          </>
        }
      />
      <EditorFooterActions
        progress={
          lastError ? (
            <>{`Save failed — ${normalizeError(lastError).message}`}</>
          ) : (updateAction.isSuccess || updateTrigger.isSuccess) && !isDirty ? (
            <>
              {editor.footer.progress} · <strong>saved</strong>
            </>
          ) : isDirty ? (
            <>
              {editor.footer.progress} · <strong>unsaved changes</strong>
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
            {isOperator ? (
              <Button onClick={handleSave} disabled={!canSave}>
                {updateAction.isPending || updateTrigger.isPending
                  ? 'Saving…'
                  : editor.footer.saveLabel}
              </Button>
            ) : null}
          </>
        }
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

// --- Per-action patch builder ----------------------------------------------

function buildActionPatch(step: AutomationEditorStepData): AutomationActionPatch {
  const patch: AutomationActionPatch = {};
  if (step.actionKind === 'send_sms_to_lead') {
    if (typeof step.bodyText === 'string') patch.body = step.bodyText;
  } else if (step.actionKind === 'send_email_to_lead') {
    if (typeof step.subject === 'string') patch.subject = step.subject;
    if (typeof step.bodyHtml === 'string') patch.body_html = step.bodyHtml;
    // Keep body_text aligned to a plain-text fallback so a reader without an
    // HTML-capable mail client still sees the message.
    if (typeof step.bodyHtml === 'string' && step.bodyHtml.length > 0) {
      patch.body_text = stripHtml(step.bodyHtml);
    } else if (typeof step.bodyText === 'string') {
      patch.body_text = step.bodyText;
    }
  }
  return patch;
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

function buildTriggerFiltersPayload(
  fields: AutomationEditableFilterField[],
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const f of fields) {
    // We only write the key when true — the resolver treats absent keys as
    // "no constraint", matching the seed config shape.
    if (f.value) payload[f.kind] = true;
  }
  return payload;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
