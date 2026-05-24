// =============================================================================
// Suite — storage buckets (lead-attachments, email-attachments).
//
// Two private buckets where the RLS policies enforce a path-prefix check
// against `private.accessible_client_ids()`. The public `section-media`
// bucket is covered by the anonymous suite (positive list test).
//
// lead-attachments  (0031)
//   path: `{clientId}/{file}` — first segment must be in the caller's acl
//   READ:  acl
//   WRITE: acl
//
// email-attachments (0064)
//   path: `{clientSlug}/{direction}/{email_message_id}/{filename}` —
//         first segment must be a slug of a client in the caller's acl
//   READ:  acl (slug-joined)
//   WRITE: service-role only (no INSERT policy for authenticated)
//
// Storage upload/list assertions read the operation status — Supabase Storage
// surfaces an explicit error on a denied write, and an empty list on a denied
// read. The harness's expectHidden / expectAbsent semantics translate cleanly.
// =============================================================================

import { randomUUID } from 'node:crypto';
import { skip, fail } from '../lib/harness.mjs';

const PNG_PIXEL = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0xfa, 0xcf, 0x00, 0x00,
  0x00, 0x02, 0x00, 0x01, 0xe5, 0x27, 0xde, 0xfc, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
  0xae, 0x42, 0x60, 0x82,
]);

export default {
  name: 'Storage buckets (lead-attachments, email-attachments)',
  register(ctx, t) {
    const { mark } = ctx.clients;
    const svc = ctx.svc;
    const voltlineId = ctx.tenants.voltline;
    const freshhomeId = ctx.tenants.freshhome;

    // ===== lead-attachments — both READ + WRITE policies ======================
    t(
      { table: 'storage.lead-attachments', policy: 'lead_attachments_insert', category: 'own', kind: 'positive', scenario: 'client uploads under its own client_id prefix' },
      async () => {
        const path = `${voltlineId}/rls-${randomUUID().slice(0, 8)}.png`;
        const { error } = await mark.storage.from('lead-attachments').upload(path, PNG_PIXEL, {
          contentType: 'image/png',
          upsert: false,
        });
        if (error) fail(`own-tenant upload should succeed — ${error.message}`);
        // Best-effort cleanup; if svc unavailable the upload is small (~70 bytes).
        await (svc ?? mark).storage.from('lead-attachments').remove([path]);
      },
    );
    t(
      { table: 'storage.lead-attachments', policy: 'lead_attachments_insert', category: 'tenant', kind: 'negative', scenario: 'client cannot upload under another tenant prefix' },
      async () => {
        const path = `${freshhomeId}/attack-${randomUUID().slice(0, 8)}.png`;
        const { error } = await mark.storage.from('lead-attachments').upload(path, PNG_PIXEL, {
          contentType: 'image/png',
          upsert: false,
        });
        if (!error) {
          // Hole — clean up before failing.
          await (svc ?? mark).storage.from('lead-attachments').remove([path]);
          fail('HOLE — a client uploaded into another tenant prefix');
        }
        // Defence-in-depth: verify nothing landed (some Storage backends
        // report errors after a partial accept).
        if (svc) {
          const { data } = await svc.storage.from('lead-attachments').list(freshhomeId, { search: path.split('/').pop() });
          if (data && data.length) {
            await svc.storage.from('lead-attachments').remove([path]);
            fail('HOLE — cross-tenant upload landed despite an error response');
          }
        }
      },
    );
    t(
      { table: 'storage.lead-attachments', policy: 'lead_attachments_read', category: 'tenant', kind: 'negative', scenario: 'client cannot list another tenant attachments folder' },
      async () => {
        if (!svc) skip('needs SUPABASE_SERVICE_ROLE_KEY to seed a cross-tenant attachment');
        const path = `${freshhomeId}/probe-${randomUUID().slice(0, 8)}.png`;
        const { error: seedErr } = await svc.storage.from('lead-attachments').upload(path, PNG_PIXEL, {
          contentType: 'image/png',
          upsert: false,
        });
        if (seedErr) fail(`could not seed cross-tenant attachment — ${seedErr.message}`);
        try {
          const { data } = await mark.storage.from('lead-attachments').list(freshhomeId, { limit: 100 });
          const leaked = (data || []).some((row) => row.name === path.split('/').pop());
          if (leaked) fail('HOLE — a client listed another tenant attachments');
        } finally {
          await svc.storage.from('lead-attachments').remove([path]);
        }
      },
    );

    // ===== email-attachments — READ-only path-prefix check =====================
    t(
      { table: 'storage.email-attachments', policy: 'email_attachments_select', category: 'capability', kind: 'negative', scenario: 'authenticated client cannot upload (service-role only)' },
      async () => {
        const path = `voltline/outbound/${randomUUID()}/attack.png`;
        const { error } = await mark.storage.from('email-attachments').upload(path, PNG_PIXEL, {
          contentType: 'image/png',
          upsert: false,
        });
        if (!error) {
          await (svc ?? mark).storage.from('email-attachments').remove([path]);
          fail('HOLE — authenticated client uploaded to email-attachments (writes are service-role only)');
        }
      },
    );
    t(
      { table: 'storage.email-attachments', policy: 'email_attachments_select', category: 'tenant', kind: 'negative', scenario: 'client cannot list another tenant slug prefix' },
      async () => {
        if (!svc) skip('needs SUPABASE_SERVICE_ROLE_KEY to seed a cross-tenant email attachment');
        // We use the actual `clients.slug` for the prefix (the policy joins
        // through `clients`). The Voltline test user is `mark`; the
        // cross-tenant probe lives under `freshhome/`.
        const path = `freshhome/inbound/${randomUUID()}/probe.png`;
        const { error: seedErr } = await svc.storage.from('email-attachments').upload(path, PNG_PIXEL, {
          contentType: 'image/png',
          upsert: false,
        });
        if (seedErr) fail(`could not seed cross-tenant email attachment — ${seedErr.message}`);
        try {
          const { data } = await mark.storage.from('email-attachments').list('freshhome/inbound', { limit: 100 });
          const leaked = (data || []).some((row) => row.name);
          if (leaked) fail('HOLE — a client listed another tenant email attachments');
        } finally {
          await svc.storage.from('email-attachments').remove([path]);
        }
      },
    );
  },
};
