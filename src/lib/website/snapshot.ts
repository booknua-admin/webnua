// =============================================================================
// Snapshot helpers (Phase 4) — pure functions, no IO.
//
// `mergeDraftsIntoSnapshot` overlays the content_drafts buffer onto a draft
// version's baseline snapshot; `diffSnapshots` produces the
// "X fields in Y sections" approval summary. Both lifted verbatim from the
// old publish-stub so the publish lanes keep identical behaviour.
// =============================================================================

import type { DraftRow } from './content-drafts';
import type { Page, Section, VersionSnapshot } from './types';
import type { WebsiteApprovalDiff } from '@/lib/tickets/website-approval-stub';

// ---- Draft overlay --------------------------------------------------------

/** Overlay the content_drafts buffer onto a baseline snapshot — a buffered
 *  slot wins over the baseline for that page / header / footer. */
export function mergeDraftsIntoSnapshot(
  base: VersionSnapshot,
  drafts: DraftRow[],
): VersionSnapshot {
  const pageDraftById = new Map<string, Section[]>();
  let headerOverride: Section | null = null;
  let footerOverride: Section | null = null;

  for (const d of drafts) {
    if (d.scopeKind === 'page' && d.pageKey) {
      pageDraftById.set(d.pageKey, d.sections);
    } else if (d.scopeKind === 'header' && d.sections[0]) {
      headerOverride = d.sections[0];
    } else if (d.scopeKind === 'footer' && d.sections[0]) {
      footerOverride = d.sections[0];
    }
  }

  const pages: Page[] = base.pages.map((page) => {
    const draftSections = pageDraftById.get(page.id);
    return draftSections ? { ...page, sections: draftSections } : page;
  });

  return {
    pages,
    header: headerOverride ?? base.header,
    footer: footerOverride ?? base.footer,
    nav: base.nav,
    pageOrder: base.pageOrder,
  };
}

// ---- Page-id repair -------------------------------------------------------

/** Re-id pages when a snapshot has duplicate page ids — a generation-era bug
 *  where every page of a site was given the shared `generation_id`. The
 *  collision breaks page tabs, the per-page content_drafts buffer, and nav
 *  targeting (every menu link resolves to the first page).
 *
 *  `nav` and `pageOrder` were built in page order at creation, so position
 *  is the only reliable correspondence — page-target nav links are remapped
 *  by index. Returns `changed: false` (and the snapshot untouched) when the
 *  ids are already unique. */
export function normalizeSnapshotPageIds(
  snapshot: VersionSnapshot,
): { snapshot: VersionSnapshot; changed: boolean } {
  const ids = snapshot.pages.map((p) => p.id);
  if (new Set(ids).size === ids.length) {
    return { snapshot, changed: false };
  }

  const pages: Page[] = snapshot.pages.map((page) => ({
    ...page,
    id: `page-${Math.random().toString(36).slice(2, 11)}`,
  }));
  const nav = snapshot.nav.map((link, i) => {
    if (link.target.kind !== 'page' || pages.length === 0) return link;
    const page = pages[Math.min(i, pages.length - 1)];
    return { ...link, target: { kind: 'page' as const, pageId: page.id } };
  });

  return {
    snapshot: { ...snapshot, pages, nav, pageOrder: pages.map((p) => p.id) },
    changed: true,
  };
}

// ---- Diff -----------------------------------------------------------------

function countSectionFieldsChanged(
  before: Section | undefined,
  after: Section,
): number {
  if (!before) return Object.keys(after.data).length;
  let count = 0;
  const beforeData = before.data ?? {};
  const afterData = after.data ?? {};
  const keys = new Set([...Object.keys(beforeData), ...Object.keys(afterData)]);
  for (const key of keys) {
    if (JSON.stringify(beforeData[key]) !== JSON.stringify(afterData[key])) {
      count++;
    }
  }
  return count;
}

/** Shallow section-field diff vs the currently-live published snapshot —
 *  the V1 "X fields changed in Y sections" approval summary (design §3.4). */
export function diffSnapshots(
  next: VersionSnapshot,
  prev: VersionSnapshot | null,
): WebsiteApprovalDiff {
  if (!prev) {
    let pagesChanged = 0;
    let sectionsChanged = 0;
    let fieldsChanged = 0;
    for (const page of next.pages) {
      if (page.sections.length === 0) continue;
      pagesChanged++;
      for (const section of page.sections) {
        sectionsChanged++;
        fieldsChanged += Object.keys(section.data).length;
      }
    }
    if (Object.keys(next.header.data).length > 0) {
      pagesChanged++;
      sectionsChanged++;
      fieldsChanged += Object.keys(next.header.data).length;
    }
    if (Object.keys(next.footer.data).length > 0) {
      pagesChanged++;
      sectionsChanged++;
      fieldsChanged += Object.keys(next.footer.data).length;
    }
    return { pagesChanged, sectionsChanged, fieldsChanged };
  }

  let pagesChanged = 0;
  let sectionsChanged = 0;
  let fieldsChanged = 0;

  const prevPageById = new Map(prev.pages.map((p) => [p.id, p]));
  for (const page of next.pages) {
    const prevPage = prevPageById.get(page.id);
    let pageTouched = false;
    const prevSectionById = new Map(
      (prevPage?.sections ?? []).map((s) => [s.id, s]),
    );
    for (const section of page.sections) {
      const before = prevSectionById.get(section.id);
      const fieldCount = countSectionFieldsChanged(before, section);
      if (fieldCount > 0) {
        sectionsChanged++;
        fieldsChanged += fieldCount;
        pageTouched = true;
      }
    }
    if (pageTouched) pagesChanged++;
  }

  const headerFields = countSectionFieldsChanged(prev.header, next.header);
  if (headerFields > 0) {
    pagesChanged++;
    sectionsChanged++;
    fieldsChanged += headerFields;
  }
  const footerFields = countSectionFieldsChanged(prev.footer, next.footer);
  if (footerFields > 0) {
    pagesChanged++;
    sectionsChanged++;
    fieldsChanged += footerFields;
  }

  return { pagesChanged, sectionsChanged, fieldsChanged };
}
