// =============================================================================
// Automation templates — operator-authored library + per-client assignment.
//
// The default automation library (lead_acknowledgment, review_request,
// cold_lead_nudge, booking_confirmation, arrival_notification) is seeded
// for every client automatically by `private.seed_default_automations()`
// at client-creation time.
//
// This module covers the OPERATOR-AUTHORED additions: templates the
// operator builds in /admin/automation-templates (V2 UI), then explicitly
// assigns to specific sub-accounts. The schema lives in migration 0108
// (`automation_templates`, `automation_template_actions`,
// `automation_assignments`); this module is the operator-side data access
// + assignment plumbing.
//
//   • listTemplates / getTemplate    — read the operator-authored library.
//   • createTemplate / updateTemplate — write template definitions.
//   • upsertTemplateActions          — replace the action list for a
//                                      template (cleanest pattern for an
//                                      operator editor).
//   • deleteTemplate                 — soft-delete by flipping is_active=false
//                                      OR hard-delete on confirmation.
//   • assignTemplate / revokeTemplate — the two RPC functions from 0108
//                                       (server-side `SECURITY DEFINER`).
//   • listAssignments                — which clients have which templates.
//
// All operator-only (RLS + SECURITY DEFINER enforce this server-side).
// =============================================================================

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

import type { AutomationEditorActionType } from './types';

/** The browser client, untyped for the not-yet-generated tables. */
function db(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

// --- types -------------------------------------------------------------------

export type AutomationTemplateRow = {
  id: string;
  template_key: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Record<string, unknown> | null;
  trigger_filters: Record<string, unknown> | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AutomationTemplateActionRow = {
  id: string;
  template_id: string;
  position: number;
  action_type: AutomationEditorActionType;
  action_config: Record<string, unknown>;
  pauses_on_human_activity: boolean;
};

export type AutomationAssignmentRow = {
  id: string;
  template_id: string;
  client_id: string;
  automation_id: string | null;
  assigned_by: string | null;
  assigned_at: string;
  is_active: boolean;
  pricing_tier: string | null;
};

// --- READS --------------------------------------------------------------------

const templatesKey = ['automation-templates'] as const;
const assignmentsKey = ['automation-assignments'] as const;

async function fetchTemplates(): Promise<AutomationTemplateRow[]> {
  const { data, error } = await db()
    .from('automation_templates')
    .select(
      'id, template_key, name, description, trigger_type, trigger_config, trigger_filters, is_active, created_by, created_at, updated_at',
    )
    .order('created_at', { ascending: false });
  if (error) throw normalizeError(error);
  return (data as AutomationTemplateRow[]) ?? [];
}

async function fetchTemplateActions(templateId: string): Promise<AutomationTemplateActionRow[]> {
  const { data, error } = await db()
    .from('automation_template_actions')
    .select('id, template_id, position, action_type, action_config, pauses_on_human_activity')
    .eq('template_id', templateId)
    .order('position', { ascending: true });
  if (error) throw normalizeError(error);
  return (data as AutomationTemplateActionRow[]) ?? [];
}

async function fetchAssignments(): Promise<AutomationAssignmentRow[]> {
  const { data, error } = await db()
    .from('automation_assignments')
    .select(
      'id, template_id, client_id, automation_id, assigned_by, assigned_at, is_active, pricing_tier',
    )
    .order('assigned_at', { ascending: false });
  if (error) throw normalizeError(error);
  return (data as AutomationAssignmentRow[]) ?? [];
}

/** All operator-authored templates (active + inactive). */
export function useAutomationTemplates() {
  return useQuery({ queryKey: templatesKey, queryFn: fetchTemplates });
}

/** All assignments — every (template, client) pair the operator has wired. */
export function useAutomationAssignments() {
  return useQuery({ queryKey: assignmentsKey, queryFn: fetchAssignments });
}

/** Actions for one template — fetched on demand from the operator editor. */
export function useTemplateActions(templateId: string | null) {
  return useQuery({
    queryKey: ['automation-template-actions', templateId],
    queryFn: () => fetchTemplateActions(templateId as string),
    enabled: templateId != null && templateId.length > 0,
  });
}

// --- WRITES -------------------------------------------------------------------

export type CreateTemplateInput = {
  templateKey: string;
  name: string;
  description?: string | null;
  triggerType: string;
  triggerConfig?: Record<string, unknown> | null;
  triggerFilters?: Record<string, unknown> | null;
};

async function createTemplate(input: CreateTemplateInput): Promise<AutomationTemplateRow> {
  const { data, error } = await db()
    .from('automation_templates')
    .insert({
      template_key: input.templateKey,
      name: input.name,
      description: input.description ?? null,
      trigger_type: input.triggerType,
      trigger_config: input.triggerConfig ?? null,
      trigger_filters: input.triggerFilters ?? null,
    })
    .select('*')
    .single();
  if (error || !data) throw normalizeError(error ?? new Error('insert failed'));
  return data as AutomationTemplateRow;
}

export function useCreateAutomationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: templatesKey });
    },
  });
}

export type UpdateTemplateInput = {
  id: string;
  patch: Partial<{
    name: string;
    description: string | null;
    trigger_type: string;
    trigger_config: Record<string, unknown> | null;
    trigger_filters: Record<string, unknown> | null;
    is_active: boolean;
  }>;
};

async function updateTemplate(input: UpdateTemplateInput): Promise<void> {
  const { error } = await db()
    .from('automation_templates')
    .update({ ...input.patch, updated_at: new Date().toISOString() })
    .eq('id', input.id);
  if (error) throw normalizeError(error);
}

export function useUpdateAutomationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateTemplate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: templatesKey });
    },
  });
}

export type UpsertActionsInput = {
  templateId: string;
  actions: Array<{
    position: number;
    actionType: AutomationEditorActionType;
    actionConfig: Record<string, unknown>;
    pausesOnHumanActivity: boolean;
  }>;
};

/** Replace the action list for a template — DELETE existing then INSERT
 *  fresh. Cleanest pattern for an editor where the operator reorders /
 *  edits actions arbitrarily; the unique (template_id, position)
 *  constraint makes incremental upserts fiddly otherwise. */
async function upsertTemplateActions(input: UpsertActionsInput): Promise<void> {
  // Delete existing actions for this template.
  const delResp = await db()
    .from('automation_template_actions')
    .delete()
    .eq('template_id', input.templateId);
  if (delResp.error) throw normalizeError(delResp.error);

  if (input.actions.length === 0) return;

  // Insert fresh in one batch.
  const rows = input.actions.map((a) => ({
    template_id: input.templateId,
    position: a.position,
    action_type: a.actionType,
    action_config: a.actionConfig,
    pauses_on_human_activity: a.pausesOnHumanActivity,
  }));
  const { error } = await db().from('automation_template_actions').insert(rows);
  if (error) throw normalizeError(error);
}

export function useUpsertTemplateActions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertTemplateActions,
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['automation-template-actions', vars.templateId] });
    },
  });
}

async function deleteTemplate(id: string): Promise<void> {
  // Hard delete — cascades via FK to automation_template_actions +
  // automation_assignments. Existing deployed automations rows are NOT
  // deleted (the assignment's automation_id FK is `on delete set null`),
  // so the operator can preserve audit + already-running flows by simply
  // toggling is_active=false on the template first via update if they
  // want a "deactivate" semantic instead.
  const { error } = await db().from('automation_templates').delete().eq('id', id);
  if (error) throw normalizeError(error);
}

export function useDeleteAutomationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: templatesKey });
      void qc.invalidateQueries({ queryKey: assignmentsKey });
    },
  });
}

// --- ASSIGNMENTS --------------------------------------------------------------

export type AssignTemplateInput = {
  templateId: string;
  clientId: string;
};

async function assignTemplate(input: AssignTemplateInput): Promise<string> {
  // The DB function (0108) does the heavy lifting — copies template into
  // automations + automation_actions, writes the assignment row,
  // returns the new automation_id.
  const { data, error } = await db().rpc('assign_template_to_client', {
    p_template_id: input.templateId,
    p_client_id: input.clientId,
  });
  if (error) throw normalizeError(error);
  return data as string;
}

export function useAssignTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: assignTemplate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: assignmentsKey });
      void qc.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}

async function revokeTemplate(input: AssignTemplateInput): Promise<void> {
  const { error } = await db().rpc('revoke_template_from_client', {
    p_template_id: input.templateId,
    p_client_id: input.clientId,
  });
  if (error) throw normalizeError(error);
}

export function useRevokeTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: revokeTemplate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: assignmentsKey });
      void qc.invalidateQueries({ queryKey: ['automations'] });
    },
  });
}
