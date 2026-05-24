'use client';

// =============================================================================
// /settings/profile — client-role profile.
//
// Pattern B critical-fix: this used to render hardcoded Voltline stub data
// from `lib/settings/client-profile.ts` (every value literal "Voltline Pty
// Ltd" / "Mark Cassidy" / "0411 567 234"). Anna at FreshHome saw Mark's data.
//
// Now reads the live `clients` row (name / industry / service_area /
// primary_contact_*) and the signed-in `users` row (display_name / email).
// Editable fields persist via Supabase update — clients_update RLS is widened
// in migration 0087 so a workspace owner (publish-cap holder) can update
// their own clients row. The user's own row is already self-updateable.
// =============================================================================

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUser, useUserContext } from '@/lib/auth/user-stub';
import { normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

type ClientProfile = {
  id: string;
  name: string;
  industry: string;
  service_area: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
};

type UserProfile = {
  id: string;
  display_name: string;
  email: string;
};

function FieldRow({
  label,
  sub,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  sub?: string;
  value: string;
  onChange: (next: string) => void;
  type?: 'text' | 'email' | 'tel';
  placeholder?: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 border-b border-dotted border-paper-2 py-4 last:border-b-0 sm:grid-cols-[220px_1fr] sm:items-start sm:gap-4">
      <div>
        <div className="text-[13px] font-semibold text-ink">{label}</div>
        {sub ? <div className="mt-0.5 text-[11.5px] text-ink-quiet">{sub}</div> : null}
      </div>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9"
      />
    </div>
  );
}

function ReadOnlyRow({ label, sub, value }: { label: string; sub?: string; value: string }) {
  return (
    <div className="grid grid-cols-1 gap-2 border-b border-dotted border-paper-2 py-4 last:border-b-0 sm:grid-cols-[220px_1fr] sm:items-start sm:gap-4">
      <div>
        <div className="text-[13px] font-semibold text-ink">{label}</div>
        {sub ? <div className="mt-0.5 text-[11.5px] text-ink-quiet">{sub}</div> : null}
      </div>
      <div className="text-[13px] text-ink">{value || <span className="text-ink-quiet">—</span>}</div>
    </div>
  );
}

export default function ClientSettingsProfilePage() {
  const user = useUser();
  const userCtx = useUserContext();

  const clientQuery = useQuery({
    queryKey: ['settings', 'profile', 'client', user?.clientId ?? null],
    queryFn: async (): Promise<ClientProfile | null> => {
      if (!user?.clientId) return null;
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, industry, service_area, primary_contact_name, primary_contact_email, primary_contact_phone')
        .eq('slug', user.clientId)
        .single();
      if (error) throw normalizeError(error);
      return data;
    },
    enabled: !!user?.clientId,
    staleTime: 30_000,
  });

  const userQuery = useQuery({
    queryKey: ['settings', 'profile', 'user', user?.id ?? null],
    queryFn: async (): Promise<UserProfile | null> => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('users')
        .select('id, display_name, email')
        .eq('id', user.id)
        .single();
      if (error) throw normalizeError(error);
      return data;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  if (!user) return <Loading />;

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Profile" />} />
      <SettingsShell
        eyebrow={`${clientQuery.data?.name ?? user.displayName} · your account`}
        title={
          <>
            Your <em>profile</em>.
          </>
        }
        subtitle={
          <>
            Your business details. <strong>What appears on your landing pages and
            in automated messages.</strong> Save when you&rsquo;re done — changes
            propagate to every funnel + automation that references your business.
          </>
        }
      >
        {clientQuery.isLoading || userQuery.isLoading ? (
          <Loading />
        ) : clientQuery.error || userQuery.error || !clientQuery.data || !userQuery.data ? (
          <ErrorPanel
            message={
              clientQuery.error instanceof Error
                ? clientQuery.error.message
                : userQuery.error instanceof Error
                  ? userQuery.error.message
                  : 'Could not load your profile.'
            }
          />
        ) : (
          <ProfileForm
            client={clientQuery.data}
            user={userQuery.data}
            onSaved={() => {
              userCtx.refreshUser();
            }}
          />
        )}
      </SettingsShell>
    </>
  );
}

function ProfileForm({
  client,
  user,
  onSaved,
}: {
  client: ClientProfile;
  user: UserProfile;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();

  // Business form state — initialized from the live row.
  const [businessName, setBusinessName] = useState(client.name);
  const [industry, setIndustry] = useState(client.industry);
  const [serviceArea, setServiceArea] = useState(client.service_area ?? '');
  const [contactName, setContactName] = useState(client.primary_contact_name ?? '');
  const [contactEmail, setContactEmail] = useState(client.primary_contact_email ?? '');
  const [contactPhone, setContactPhone] = useState(client.primary_contact_phone ?? '');

  // User form state.
  const [displayName, setDisplayName] = useState(user.display_name);

  const [error, setError] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState(false);

  // Re-sync local state if the source rows refetch (e.g. after another tab
  // saves). State-in-effect is the canonical pattern for "external store →
  // controlled form draft" — same idiom as QuietHoursSection.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setBusinessName(client.name);
    setIndustry(client.industry);
    setServiceArea(client.service_area ?? '');
    setContactName(client.primary_contact_name ?? '');
    setContactEmail(client.primary_contact_email ?? '');
    setContactPhone(client.primary_contact_phone ?? '');
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [client.id, client.name, client.industry, client.service_area, client.primary_contact_name, client.primary_contact_email, client.primary_contact_phone]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisplayName(user.display_name);
  }, [user.id, user.display_name]);

  const businessDirty =
    businessName.trim() !== client.name ||
    industry.trim() !== client.industry ||
    serviceArea.trim() !== (client.service_area ?? '') ||
    contactName.trim() !== (client.primary_contact_name ?? '') ||
    contactEmail.trim() !== (client.primary_contact_email ?? '') ||
    contactPhone.trim() !== (client.primary_contact_phone ?? '');
  const userDirty = displayName.trim() !== user.display_name;
  const dirty = businessDirty || userDirty;

  const save = useMutation({
    mutationFn: async () => {
      setError(null);
      if (!businessName.trim()) throw new Error('Business name is required.');
      if (!industry.trim()) throw new Error('Industry is required.');
      if (!displayName.trim()) throw new Error('Display name is required.');

      if (businessDirty) {
        const { error: clientErr } = await supabase
          .from('clients')
          .update({
            name: businessName.trim(),
            industry: industry.trim(),
            service_area: serviceArea.trim() || null,
            primary_contact_name: contactName.trim() || null,
            primary_contact_email: contactEmail.trim() || null,
            primary_contact_phone: contactPhone.trim() || null,
          })
          .eq('id', client.id);
        if (clientErr) throw normalizeError(clientErr);
      }

      if (userDirty) {
        const { error: userErr } = await supabase
          .from('users')
          .update({ display_name: displayName.trim() })
          .eq('id', user.id);
        if (userErr) throw normalizeError(userErr);
      }
    },
    onSuccess: () => {
      setSavedHint(true);
      window.setTimeout(() => setSavedHint(false), 2000);
      queryClient.invalidateQueries({ queryKey: ['settings', 'profile'] });
      onSaved();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Save failed.');
    },
  });

  return (
    <SettingsPanel>
      <SettingsSection
        heading={
          <>
            Business <em>profile</em>
          </>
        }
        description="What appears on your landing pages and on automated messages your customers receive. Changes save to your workspace immediately."
      >
        <div className="flex flex-col">
          <FieldRow
            label="Business name"
            sub="Shown across your site + invoices"
            value={businessName}
            onChange={setBusinessName}
            placeholder="Acme Plumbing"
          />
          <FieldRow
            label="Trade / industry"
            sub="A short category, e.g. Residential electrician"
            value={industry}
            onChange={setIndustry}
            placeholder="Residential plumber"
          />
          <FieldRow
            label="Service area"
            sub="The suburbs / cities you cover"
            value={serviceArea}
            onChange={setServiceArea}
            placeholder="Inner west Sydney"
          />
        </div>
      </SettingsSection>

      <SettingsSection
        heading={
          <>
            Primary <em>contact</em>
          </>
        }
        description="Where Webnua reaches you. Used on lead-acknowledgment SMS / emails (replies route here) and to send you notifications."
      >
        <div className="flex flex-col">
          <FieldRow
            label="Contact name"
            value={contactName}
            onChange={setContactName}
            placeholder="Mark Cassidy"
          />
          <FieldRow
            label="Contact email"
            type="email"
            value={contactEmail}
            onChange={setContactEmail}
            placeholder="hello@yourbusiness.com"
          />
          <FieldRow
            label="Contact phone"
            sub="In international format, e.g. +61 411 234 567"
            type="tel"
            value={contactPhone}
            onChange={setContactPhone}
            placeholder="+61 411 234 567"
          />
        </div>
      </SettingsSection>

      <SettingsSection
        heading={
          <>
            Your <em>login</em>
          </>
        }
        description="The signed-in user — that's you. Email is the login itself (change via Login + security)."
      >
        <div className="flex flex-col">
          <FieldRow
            label="Display name"
            sub="How Webnua addresses you in-app"
            value={displayName}
            onChange={setDisplayName}
            placeholder="Mark"
          />
          <ReadOnlyRow
            label="Login email"
            sub="Edit on the Login + security tab"
            value={user.email}
          />
        </div>
      </SettingsSection>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        {error ? (
          <p className="text-[12px] font-semibold text-warn">{error}</p>
        ) : savedHint ? (
          <p className="text-[12px] font-semibold text-good">Saved ✓</p>
        ) : null}
        <Button
          onClick={() => save.mutate()}
          disabled={!dirty || save.isPending}
        >
          {save.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </SettingsPanel>
  );
}

function Loading() {
  return (
    <div className="rounded-lg border border-dashed border-rule bg-paper px-6 py-5 text-[13px] leading-[1.55] text-ink-quiet">
      One moment — loading your profile.
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-warn/30 bg-warn/5 px-6 py-5 text-[13px] leading-[1.55] text-warn">
      Could not load your profile: {message}
    </div>
  );
}
