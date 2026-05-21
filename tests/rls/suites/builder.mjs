// =============================================================================
// Suite — builder layer: websites, website_versions, funnels, funnel_versions,
// content_drafts, website_approval_submissions, funnel_approval_submissions,
// generation_log, force_publish_audit_log.
//
// Two version/approval tables gate INSERT on private.has_capability() rather
// than on tenant membership. has_capability() returns true for a workspace-wide
// ('*') capability grant on ANY website — so a client holding such a grant could
// historically write versions/submissions into ANOTHER tenant's website. The
// cross-tenant tests below (mark holds a workspace-wide editSections grant)
// catch exactly that; migration 0045 adds the missing tenant AND-clause.
// =============================================================================

import { randomUUID } from 'node:crypto';
import { clientScoped, childCrossTenant } from '../lib/scenarios.mjs';
import { expectVisible, expectHidden, expectAbsent, expectWriteOk, fail } from '../lib/harness.mjs';

export default {
  name: 'Builder layer (websites, versions, drafts, approvals, audit)',
  register(ctx, t) {
    const { mark, anna, craig } = ctx.clients;
    const op = ctx.operator;
    const F = ctx.fixture;

    // ===== websites / funnels (client-scoped, operator-only write) ===========
    clientScoped(t, ctx, {
      table: 'websites',
      policy: 'websites',
      key: 'website',
      updateColumn: 'name',
      clientWritable: false,
      buildRow: (clientId, id) => ({
        id,
        client_id: clientId,
        name: 'rls',
        domain_primary: `rls-${id.slice(0, 8)}.example`,
      }),
    });
    clientScoped(t, ctx, {
      table: 'funnels',
      policy: 'funnels',
      key: 'funnel',
      updateColumn: 'name',
      clientWritable: false,
      buildRow: (clientId, id) => ({
        id,
        client_id: clientId,
        name: 'rls',
        domain_primary: `rls-${id.slice(0, 8)}-funnel.example`,
      }),
    });

    // ===== website_versions — the capability-vs-tenant boundary ==============
    t(
      { table: 'website_versions', policy: 'website_versions_select', category: 'own', kind: 'positive', scenario: 'client reads a version in its own tenant' }, // prettier-ignore
      async () =>
        expectVisible('own version', await mark.from('website_versions').select('*').eq('id', F.voltline.websiteVersion)), // prettier-ignore
    );
    t(
      { table: 'website_versions', policy: 'website_versions_select', category: 'tenant', kind: 'negative', scenario: 'client cannot read another tenant version' }, // prettier-ignore
      async () =>
        expectHidden('cross version', await mark.from('website_versions').select('*').eq('id', F.freshhome.websiteVersion)), // prettier-ignore
    );
    t(
      { table: 'website_versions', policy: 'website_versions_insert', category: 'capability', kind: 'positive', scenario: 'capable client creates a draft in its own website' }, // prettier-ignore
      async () => {
        const id = randomUUID();
        const res = await mark.from('website_versions').insert({
          id,
          website_id: F.voltline.website,
          status: 'draft',
          snapshot: {},
          created_by: ctx.ids.mark,
        });
        expectWriteOk('capable draft insert', res);
        await op.from('website_versions').delete().eq('id', id);
      },
    );
    t(
      { table: 'website_versions', policy: 'website_versions_insert', category: 'capability', kind: 'negative', scenario: 'uncapped client cannot create a draft version' }, // prettier-ignore
      async () => {
        const id = randomUUID();
        await anna.from('website_versions').insert({
          id,
          website_id: F.freshhome.website,
          status: 'draft',
          snapshot: {},
          created_by: ctx.ids.anna,
        });
        await expectAbsent('uncapped draft insert', op, 'website_versions', 'id', id);
      },
    );
    t(
      { table: 'website_versions', policy: 'website_versions_insert', category: 'capability', kind: 'negative', scenario: 'editSections client cannot publish (needs publish cap)' }, // prettier-ignore
      async () => {
        const id = randomUUID();
        await mark.from('website_versions').insert({
          id,
          website_id: F.voltline.website,
          status: 'published',
          snapshot: {},
          created_by: ctx.ids.mark,
        });
        await expectAbsent('publish without cap', op, 'website_versions', 'id', id);
      },
    );
    // THE HOLE: a workspace-wide editSections grant must NOT let a client write
    // a version into another tenant's website.
    t(
      { table: 'website_versions', policy: 'website_versions_insert', category: 'tenant', kind: 'negative', scenario: 'workspace-wide grant cannot write a cross-tenant version' }, // prettier-ignore
      async () => {
        const id = randomUUID();
        await mark.from('website_versions').insert({
          id,
          website_id: F.freshhome.website,
          status: 'draft',
          snapshot: {},
          created_by: ctx.ids.mark,
        });
        await expectAbsent('cross-tenant version', op, 'website_versions', 'id', id);
      },
    );

    // ===== website_approval_submissions — same boundary ======================
    t(
      { table: 'website_approval_submissions', policy: 'website_approval_submissions_select', category: 'own', kind: 'positive', scenario: 'client reads an approval in its own tenant' }, // prettier-ignore
      async () =>
        expectVisible('own approval', await mark.from('website_approval_submissions').select('*').eq('id', F.voltline.websiteApproval)), // prettier-ignore
    );
    t(
      { table: 'website_approval_submissions', policy: 'website_approval_submissions_select', category: 'tenant', kind: 'negative', scenario: 'client cannot read another tenant approval' }, // prettier-ignore
      async () =>
        expectHidden('cross approval', await mark.from('website_approval_submissions').select('*').eq('id', F.freshhome.websiteApproval)), // prettier-ignore
    );
    t(
      { table: 'website_approval_submissions', policy: 'website_approval_submissions_insert', category: 'capability', kind: 'negative', scenario: 'uncapped client cannot submit for approval' }, // prettier-ignore
      async () => {
        const id = randomUUID();
        await anna.from('website_approval_submissions').insert({
          id,
          website_id: F.freshhome.website,
          pending_version_id: F.freshhome.websiteVersion,
          submitter_id: ctx.ids.anna,
          diff: {},
        });
        await expectAbsent('uncapped submit', op, 'website_approval_submissions', 'id', id);
      },
    );
    // THE HOLE: the workspace-wide grant must not reach across tenants here either.
    t(
      { table: 'website_approval_submissions', policy: 'website_approval_submissions_insert', category: 'tenant', kind: 'negative', scenario: 'workspace-wide grant cannot submit a cross-tenant approval' }, // prettier-ignore
      async () => {
        const id = randomUUID();
        await mark.from('website_approval_submissions').insert({
          id,
          website_id: F.freshhome.website,
          pending_version_id: F.freshhome.websiteVersion,
          submitter_id: ctx.ids.mark,
          diff: {},
        });
        await expectAbsent('cross-tenant submit', op, 'website_approval_submissions', 'id', id);
      },
    );

    // ===== funnel_versions / content_drafts / funnel_approval_submissions ====
    childCrossTenant(t, ctx, {
      table: 'funnel_versions',
      policy: 'funnel_versions',
      key: 'funnelVersion',
      parentKey: 'funnel',
      buildRow: (funnelId, id) => ({
        id,
        funnel_id: funnelId,
        status: 'draft',
        snapshot: {},
        created_by: ctx.ids.mark,
      }),
    });
    childCrossTenant(t, ctx, {
      table: 'content_drafts',
      policy: 'content_drafts',
      key: 'contentDraft',
      parentKey: 'website',
      buildRow: (websiteId, id) => ({
        id,
        scope_kind: 'page',
        website_id: websiteId,
        page_key: `rls-${id.slice(0, 8)}`,
        sections: [],
        saved_at: new Date().toISOString(),
        updated_by: ctx.ids.mark,
      }),
    });
    childCrossTenant(t, ctx, {
      table: 'funnel_approval_submissions',
      policy: 'funnel_approval_submissions',
      key: 'funnelApproval',
      parentKey: 'funnel',
      buildRow: (funnelId, id, c) => ({
        id,
        funnel_id: funnelId,
        pending_funnel_version_id: c.fixture.freshhome.funnelVersion,
        submitter_id: ctx.ids.mark,
        diff: {},
      }),
    });

    // ===== generation_log — operator-only ====================================
    t(
      { table: 'generation_log', policy: 'generation_log_select', category: 'capability', kind: 'negative', scenario: 'client cannot read the generation log' }, // prettier-ignore
      async () =>
        expectHidden('client generation_log', await mark.from('generation_log').select('*').eq('id', F.voltline.generationLog)), // prettier-ignore
    );
    t(
      { table: 'generation_log', policy: 'generation_log_select', category: 'own', kind: 'positive', scenario: 'operator reads the generation log' }, // prettier-ignore
      async () =>
        expectVisible('operator generation_log', await craig.from('generation_log').select('*').eq('id', F.voltline.generationLog)), // prettier-ignore
    );
    t(
      { table: 'generation_log', policy: 'generation_log_insert', category: 'capability', kind: 'negative', scenario: 'client cannot write the generation log' }, // prettier-ignore
      async () => {
        const id = randomUUID();
        await mark.from('generation_log').insert({
          id,
          generation_id: randomUUID(),
          client_id: ctx.tenants.voltline,
          section_type: 'hero',
          field_name: 'rls',
          reason: 'missing',
        });
        await expectAbsent('client generation_log insert', op, 'generation_log', 'id', id);
      },
    );

    // ===== force_publish_audit_log — operator-only ===========================
    t(
      { table: 'force_publish_audit_log', policy: 'force_publish_audit_log_select', category: 'capability', kind: 'negative', scenario: 'client cannot read the force-publish audit log' }, // prettier-ignore
      async () =>
        expectHidden('client audit log', await mark.from('force_publish_audit_log').select('*').eq('id', F.voltline.forcePublishLog)), // prettier-ignore
    );
    t(
      { table: 'force_publish_audit_log', policy: 'force_publish_audit_log_select', category: 'own', kind: 'positive', scenario: 'operator reads the force-publish audit log' }, // prettier-ignore
      async () =>
        expectVisible('operator audit log', await craig.from('force_publish_audit_log').select('*').eq('id', F.voltline.forcePublishLog)), // prettier-ignore
    );
    t(
      { table: 'force_publish_audit_log', policy: 'force_publish_audit_log_insert', category: 'capability', kind: 'negative', scenario: 'client cannot forge a force-publish audit entry' }, // prettier-ignore
      async () => {
        const id = randomUUID();
        await mark.from('force_publish_audit_log').insert({
          id,
          actor_user_id: ctx.ids.mark,
          website_id: F.voltline.website,
          new_version_id: F.voltline.websiteVersion,
          reason: 'rls',
        });
        await expectAbsent('client audit insert', op, 'force_publish_audit_log', 'id', id);
      },
    );
  },
};
