'use client';

// =============================================================================
// QuietHoursSection — per-client quiet-hours editor for automation comm
// actions (Phase 8 · Session 4 suppression layer).
//
// Sub-account-mode operator surface. Quiet hours are a per-client window
// (e.g. "no SMS to my customers between 21:00 and 08:00 in Europe/Dublin")
// the suppression layer reads before every customer-facing SMS / email an
// automation triggers. Inside the window, the engine DEFERS the action
// until the end of the window — it never sends + skips silently.
//
// Storage: `clients.quiet_hours_start / _end / _timezone` (migration 0083).
// Empty start OR empty end = no quiet hours, send any time.
//
// Operators only — clients don't see this surface (per-client governance).
// =============================================================================

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { Input } from '@/components/ui/input';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { supabase } from '@/lib/supabase/client';

type Props = {
  clientId: string | null;
};

// Curated IANA TZ shortlist — covers the most common Webnua deploys. Add
// rows as new regions onboard rather than shipping the full IANA list.
const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/Dublin', label: 'Dublin (Ireland)' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'America/New_York', label: 'New York' },
  { value: 'America/Chicago', label: 'Chicago' },
  { value: 'America/Los_Angeles', label: 'Los Angeles' },
  { value: 'Australia/Perth', label: 'Perth' },
  { value: 'Australia/Sydney', label: 'Sydney' },
];

type QuietHoursState = { start: string; end: string; timezone: string };

const EMPTY: QuietHoursState = { start: '', end: '', timezone: 'UTC' };

export function QuietHoursSection({ clientId }: Props) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<QuietHoursState>(EMPTY);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState(false);

  const query = useQuery({
    queryKey: ['client', 'quiet-hours', clientId],
    queryFn: async (): Promise<QuietHoursState> => {
      if (!clientId) return EMPTY;
      const { data, error } = await supabase
        .from('clients')
        // The new quiet_hours columns aren't in the generated types yet;
        // cast through `never` to read them (same pattern as other Phase
        // 7/8 settings surfaces).
        .select('quiet_hours_start, quiet_hours_end, quiet_hours_timezone' as never)
        .eq('id', clientId)
        .maybeSingle();
      if (error) throw error;
      const row = (data ?? {}) as {
        quiet_hours_start?: string | null;
        quiet_hours_end?: string | null;
        quiet_hours_timezone?: string | null;
      };
      return {
        start: normaliseTime(row.quiet_hours_start),
        end: normaliseTime(row.quiet_hours_end),
        timezone: row.quiet_hours_timezone ?? 'UTC',
      };
    },
    enabled: Boolean(clientId),
  });

  // Sync the draft to whatever the server last returned. The dependency on
  // the query result guarantees the form re-syncs after a successful save
  // OR when the client switches (in agency-mode setups). State-in-effect
  // is the canonical pattern for "external store → controlled form draft".
  useEffect(() => {
    if (query.data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(query.data);
    }
  }, [query.data]);

  const initial = query.data ?? EMPTY;
  const dirty =
    draft.start !== initial.start ||
    draft.end !== initial.end ||
    draft.timezone !== initial.timezone;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error('no-client');

      const payload: Record<string, unknown> = {
        quiet_hours_timezone: draft.timezone,
      };
      const startSet = draft.start.trim().length > 0;
      const endSet = draft.end.trim().length > 0;
      if (!startSet && !endSet) {
        payload.quiet_hours_start = null;
        payload.quiet_hours_end = null;
      } else if (startSet && endSet) {
        payload.quiet_hours_start = draft.start;
        payload.quiet_hours_end = draft.end;
      } else {
        throw new Error('partial-window');
      }

      const { error } = await supabase
        .from('clients')
        .update(payload as never)
        .eq('id', clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      setSavedHint(true);
      queryClient.invalidateQueries({
        queryKey: ['client', 'quiet-hours', clientId],
      });
    },
  });

  async function save() {
    setValidationError(null);
    setSavedHint(false);

    const startSet = draft.start.trim().length > 0;
    const endSet = draft.end.trim().length > 0;
    if (startSet !== endSet) {
      setValidationError(
        'Set BOTH start and end, or leave BOTH blank for no quiet hours.',
      );
      return;
    }
    saveMutation.mutate();
  }

  const loading = Boolean(clientId) && query.isLoading;
  const saving = saveMutation.isPending;
  const serverError = query.isError
    ? 'Could not load quiet hours.'
    : saveMutation.isError
    ? (saveMutation.error as Error)?.message ?? 'Could not save.'
    : null;
  const error = validationError ?? serverError;

  return (
    <SettingsSection
      heading={
        <>
          Quiet <em>hours</em>
        </>
      }
      description={
        <>
          <strong>When automations should hold customer-facing messages.</strong>{' '}
          Inside this window, automation SMS and email to leads are deferred to
          the end of the window — never silently dropped. Operator notifications
          and transactional sends are not affected.
        </>
      }
    >
      {!clientId ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          {'// Resolving client…'}
        </p>
      ) : loading ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          {'// Loading…'}
        </p>
      ) : (
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <Eyebrow tone="quiet">Start</Eyebrow>
              <Input
                type="time"
                value={draft.start}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, start: e.target.value }))
                }
                disabled={saving}
              />
            </label>
            <label className="flex flex-col gap-1">
              <Eyebrow tone="quiet">End</Eyebrow>
              <Input
                type="time"
                value={draft.end}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, end: e.target.value }))
                }
                disabled={saving}
              />
            </label>
            <label className="flex flex-col gap-1">
              <Eyebrow tone="quiet">Timezone</Eyebrow>
              <select
                className="h-10 rounded-md border border-input bg-card px-3 text-[14px]"
                value={draft.timezone}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, timezone: e.target.value }))
                }
                disabled={saving}
              >
                {TIMEZONE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
            {'// When end < start the window wraps midnight (e.g. 22:00 → 07:00).'}
          </p>
          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={saving || !dirty}>
              {saving ? 'Saving…' : 'Save quiet hours'}
            </Button>
            {savedHint ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-good">
                {'// Saved'}
              </span>
            ) : null}
            {error ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-warn">
                {`// ${error}`}
              </span>
            ) : null}
          </div>
        </div>
      )}
    </SettingsSection>
  );
}

function normaliseTime(raw: string | null | undefined): string {
  if (!raw) return '';
  // Postgres `time` rounds back as "HH:MM:SS"; the HTML time input wants
  // "HH:MM". Trim the seconds.
  const match = /^(\d{2}):(\d{2})/.exec(raw);
  return match ? `${match[1]}:${match[2]}` : raw;
}
