// =============================================================================
// Suite — approval spine + ads flags + social calendar (migrations 0119-0122).
//
// Three policy shapes:
//
//   • suggested_actions — tenant-READABLE + tenant-UPDATABLE (dismiss runs
//     browser-direct); INSERT/DELETE revoked from authenticated (job
//     handlers + the approve route write via service-role).
//
//   • meta_campaign_flags — tenant-READABLE only; ALL authenticated writes
//     revoked (the anomaly detector owns the lifecycle).
//
//   • social_posts — tenant FULL-CRUD (owners manage their own calendar);
//     the bright line is the TENANT boundary, not the verb.
//
// All cross-tenant probes verify persisted state through the service-role
// verifier — never the attacker's error code.
// =============================================================================

import { randomUUID } from 'node:crypto';
import {
  expectVisible,
  expectHidden,
  expectAbsent,
  expectUnchanged,
  expectStillExists,
  skip,
} from '../lib/harness.mjs';

export default {
  name: 'Approval spine (suggested_actions) + ads flags + social calendar',
  register(ctx, t) {
    const { mark, craig } = ctx.clients;
    const svc = ctx.svc;

    if (!ctx.phase7Seeded) {
      t(
        { table: 'suggested_actions', policy: 'approval_suite', category: 'capability', kind: 'negative', scenario: 'suite skipped — SUPABASE_SERVICE_ROLE_KEY required to seed' },
        async () => skip('suggested_actions / meta_campaign_flags revoke authenticated inserts; needs service-role to seed'),
      );
      return;
    }
    const F = ctx.fixture;

    // ===== suggested_actions ==================================================

    t(
      { table: 'suggested_actions', policy: 'suggested_actions_select', category: 'own', kind: 'positive', scenario: 'client reads its own tenant action' },
      async () =>
        expectVisible('own suggested_actions', await mark.from('suggested_actions').select('*').eq('id', F.voltline.suggestedAction)),
    );
    t(
      { table: 'suggested_actions', policy: 'suggested_actions_select', category: 'tenant', kind: 'negative', scenario: 'client cannot read another tenant action' },
      async () =>
        expectHidden('cross suggested_actions', await mark.from('suggested_actions').select('*').eq('id', F.freshhome.suggestedAction)),
    );
    t(
      { table: 'suggested_actions', policy: 'suggested_actions_update', category: 'tenant', kind: 'negative', scenario: 'client cannot dismiss another tenant action' },
      async () => {
        await mark
          .from('suggested_actions')
          .update({ status: 'dismissed' })
          .eq('id', F.freshhome.suggestedAction);
        await expectUnchanged('cross dismiss', svc, 'suggested_actions', F.freshhome.suggestedAction, 'status', 'dismissed');
      },
    );
    t(
      { table: 'suggested_actions', policy: 'suggested_actions_insert', category: 'capability', kind: 'negative', scenario: 'authenticated INSERT is revoked (service-role only)' },
      async () => {
        const id = randomUUID();
        await mark.from('suggested_actions').insert({
          id, client_id: ctx.tenants.voltline, kind: 'generic', title: 'rls attack',
        });
        await expectAbsent('client suggested_actions insert', svc, 'suggested_actions', 'id', id);
      },
    );
    t(
      { table: 'suggested_actions', policy: 'suggested_actions_delete', category: 'capability', kind: 'negative', scenario: 'authenticated DELETE is revoked' },
      async () => {
        await mark.from('suggested_actions').delete().eq('id', F.voltline.suggestedAction);
        await expectStillExists('client suggested_actions delete', svc, 'suggested_actions', F.voltline.suggestedAction);
      },
    );
    t(
      { table: 'suggested_actions', policy: 'suggested_actions_select', category: 'own', kind: 'positive', scenario: 'operator reads tenant actions' },
      async () =>
        expectVisible('operator suggested_actions', await craig.from('suggested_actions').select('*').eq('id', F.voltline.suggestedAction)),
    );

    // ===== meta_campaign_flags ================================================

    t(
      { table: 'meta_campaign_flags', policy: 'meta_campaign_flags_select', category: 'own', kind: 'positive', scenario: 'client reads its own tenant flag' },
      async () =>
        expectVisible('own meta_campaign_flags', await mark.from('meta_campaign_flags').select('*').eq('id', F.voltline.campaignFlag)),
    );
    t(
      { table: 'meta_campaign_flags', policy: 'meta_campaign_flags_select', category: 'tenant', kind: 'negative', scenario: 'client cannot read another tenant flag' },
      async () =>
        expectHidden('cross meta_campaign_flags', await mark.from('meta_campaign_flags').select('*').eq('id', F.freshhome.campaignFlag)),
    );
    t(
      { table: 'meta_campaign_flags', policy: 'meta_campaign_flags_update', category: 'capability', kind: 'negative', scenario: 'authenticated UPDATE is revoked (detector-owned lifecycle)' },
      async () => {
        await mark
          .from('meta_campaign_flags')
          .update({ status: 'resolved' })
          .eq('id', F.voltline.campaignFlag);
        await expectUnchanged('client flag update', svc, 'meta_campaign_flags', F.voltline.campaignFlag, 'status', 'resolved');
      },
    );

    // ===== social_posts =======================================================

    t(
      { table: 'social_posts', policy: 'social_posts_select', category: 'own', kind: 'positive', scenario: 'client reads its own calendar' },
      async () =>
        expectVisible('own social_posts', await mark.from('social_posts').select('*').eq('id', F.voltline.socialPost)),
    );
    t(
      { table: 'social_posts', policy: 'social_posts_select', category: 'tenant', kind: 'negative', scenario: 'client cannot read another tenant calendar' },
      async () =>
        expectHidden('cross social_posts', await mark.from('social_posts').select('*').eq('id', F.freshhome.socialPost)),
    );
    t(
      { table: 'social_posts', policy: 'social_posts_insert', category: 'tenant', kind: 'negative', scenario: 'client cannot create a post in another tenant' },
      async () => {
        const id = randomUUID();
        await mark.from('social_posts').insert({
          id, client_id: ctx.tenants.freshhome, caption: 'rls attack', scheduled_for: new Date().toISOString(),
        });
        await expectAbsent('cross social_posts insert', svc, 'social_posts', 'id', id);
      },
    );
    t(
      { table: 'social_posts', policy: 'social_posts_update', category: 'tenant', kind: 'negative', scenario: 'client cannot approve another tenant post' },
      async () => {
        await mark
          .from('social_posts')
          .update({ status: 'approved' })
          .eq('id', F.freshhome.socialPost);
        await expectUnchanged('cross social approve', svc, 'social_posts', F.freshhome.socialPost, 'status', 'approved');
      },
    );
    t(
      { table: 'social_posts', policy: 'social_posts_update', category: 'own', kind: 'positive', scenario: 'client edits its own post caption' },
      async () => {
        const next = `rls-edit-${randomUUID().slice(0, 6)}`;
        const { error } = await mark
          .from('social_posts')
          .update({ caption: next })
          .eq('id', F.voltline.socialPost);
        if (error) throw new Error(`own-tenant social_posts update errored — ${error.message}`);
        const { data } = await svc
          .from('social_posts')
          .select('caption')
          .eq('id', F.voltline.socialPost)
          .maybeSingle();
        if (data?.caption !== next) {
          throw new Error('own-tenant social_posts update did not persist');
        }
      },
    );
  },
};
