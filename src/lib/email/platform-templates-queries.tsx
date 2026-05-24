// =============================================================================
// Platform email templates — read + write hooks for the operator settings
// surface at /settings/platform-templates.
//
// Phase 8 · Session 3. Backs `platform_email_templates` (migration 0079).
// RLS is operator-only (select + update); insert/delete are service-role
// only — the rows are seeded by the migration, never created from the app.
// =============================================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppError, normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

export type PlatformTemplateKey = 'lead_notification' | 'lead_digest';

export type PlatformEmailTemplate = {
  templateKey: PlatformTemplateKey;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  lastEditedAt: string | null;
};

const TABLE = 'platform_email_templates';

async function fetchPlatformTemplates(): Promise<PlatformEmailTemplate[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  // platform_email_templates is not in the generated Database type yet
  // (regen runs after migrations apply). Untyped client cast.
  const { data, error } = await (
    supabase.from(TABLE as never) as unknown as {
      select: (cols: string) => {
        order: (col: string, opts: { ascending: boolean }) => Promise<{
          data:
            | Array<{
                template_key: PlatformTemplateKey;
                subject: string;
                body_html: string;
                body_text: string;
                last_edited_at: string | null;
              }>
            | null;
          error: { message: string } | null;
        }>;
      };
    }
  )
    .select('template_key, subject, body_html, body_text, last_edited_at')
    .order('template_key', { ascending: true });
  if (error) throw normalizeError(error);

  return (data ?? []).map((row) => ({
    templateKey: row.template_key,
    subject: row.subject,
    bodyHtml: row.body_html,
    bodyText: row.body_text,
    lastEditedAt: row.last_edited_at,
  }));
}

export function usePlatformTemplates() {
  return useQuery({
    queryKey: ['platform-templates', 'list'],
    queryFn: fetchPlatformTemplates,
  });
}

async function updatePlatformTemplate(input: {
  templateKey: PlatformTemplateKey;
  subject: string;
  bodyText: string;
}): Promise<void> {
  const bodyHtml = textToHtml(input.bodyText);
  const { error } = await (
    supabase.from(TABLE as never) as unknown as {
      update: (patch: Record<string, unknown>) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update({
      subject: input.subject,
      body_text: input.bodyText,
      body_html: bodyHtml,
      last_edited_at: new Date().toISOString(),
    })
    .eq('template_key', input.templateKey);
  if (error) throw normalizeError(error);
}

function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

export function useUpdatePlatformTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePlatformTemplate,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['platform-templates'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Variable catalog — the operator-facing notification templates carry the
// `lead.*`, `client.*`, `platform.*`, and `digest.*` placeholder families.
// Each entry pairs the placeholder with a one-line description for the
// variable chip's title attribute. Source of truth for the editor's
// click-to-insert chips.
// ---------------------------------------------------------------------------

export type PlatformTemplateVariable = {
  code: string;
  description: string;
};

export const LEAD_NOTIFICATION_VARIABLES: ReadonlyArray<PlatformTemplateVariable> = [
  { code: '{{client.businessName}}', description: "The client's business name." },
  { code: '{{client.shortName}}', description: "The client's display first name." },
  { code: '{{lead.firstName}}', description: "Lead's first name." },
  { code: '{{lead.fullName}}', description: "Lead's full name." },
  { code: '{{lead.lastNameSuffix}}', description: 'Empty when no surname; " Surname" otherwise.' },
  { code: '{{lead.email}}', description: "Lead's email." },
  { code: '{{lead.phone}}', description: "Lead's phone." },
  { code: '{{lead.service}}', description: 'What they asked for.' },
  { code: '{{lead.preview}}', description: 'Preview of the submission body.' },
  { code: '{{platform.inboxLink}}', description: 'Deep-link into the Webnua inbox.' },
];

export const LEAD_DIGEST_VARIABLES: ReadonlyArray<PlatformTemplateVariable> = [
  { code: '{{client.businessName}}', description: "The client's business name." },
  { code: '{{digest.count}}', description: 'Number of new leads in the digest window.' },
  { code: '{{platform.inboxLink}}', description: 'Deep-link into the Webnua inbox.' },
];

export function variablesForTemplate(
  templateKey: PlatformTemplateKey,
): ReadonlyArray<PlatformTemplateVariable> {
  return templateKey === 'lead_digest'
    ? LEAD_DIGEST_VARIABLES
    : LEAD_NOTIFICATION_VARIABLES;
}

// ---------------------------------------------------------------------------
// Sample data — used by the editor's preview pane. Renders the template
// with realistic-but-fake values so the operator can see what the email
// will look like. Pure on (template, samples).
// ---------------------------------------------------------------------------

const SAMPLE_CONTEXT: Record<string, string> = {
  'client.businessName': 'Voltline Electrical',
  'client.shortName': 'Mark',
  'lead.firstName': 'Sarah',
  'lead.fullName': 'Sarah Davies',
  'lead.lastNameSuffix': ' Davies',
  'lead.email': 'sarah.davies@example.com',
  'lead.phone': '+61 412 555 089',
  'lead.service': 'Burst pipe — 9pm emergency call-out',
  'lead.preview':
    '"Hot water tank started leaking under the stairs — any chance someone could come tonight?"',
  'platform.inboxLink': 'https://app.webnua.com/leads/sample-lead-id',
  'digest.count': '4',
};

export function renderTemplatePreview(template: string): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    const trimmed = key.trim();
    return SAMPLE_CONTEXT[trimmed] ?? `{{${trimmed}}}`;
  });
}
