/* eslint-disable no-console */
// =============================================================================
// audit-stock-images — sanity-probe every Unsplash URL the industry templates
// ship. Run locally (not in CI — Bundle B's image injection tolerates a 404
// by falling back to whatever the model emitted, which is usually empty).
//
//   pnpm tsx scripts/audit-stock-images.ts
//
// Output: one line per URL with status, plus a summary tally per industry.
// Any 4xx/5xx URLs are candidates for a follow-up refresh session.
// =============================================================================

import { INDUSTRY_TEMPLATES } from '../src/lib/website/industry-templates';

type ProbeResult = { industry: string; field: string; url: string; status: number | 'error'; ms: number };

async function probe(url: string): Promise<{ status: number | 'error'; ms: number }> {
  const start = Date.now();
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return { status: res.status, ms: Date.now() - start };
  } catch {
    return { status: 'error', ms: Date.now() - start };
  }
}

async function main(): Promise<void> {
  const results: ProbeResult[] = [];

  for (const [industryKey, template] of Object.entries(INDUSTRY_TEMPLATES)) {
    const targets: { field: string; url: string }[] = [];
    targets.push({ field: 'hero', url: template.stockImages.hero });
    template.stockImages.gallery.forEach((url, i) =>
      targets.push({ field: `gallery[${i}]`, url }),
    );
    if (template.stockImages.team) {
      targets.push({ field: 'team', url: template.stockImages.team });
    }
    for (const t of targets) {
      // Probe sequentially per industry so output is grouped.
      const r = await probe(t.url);
      results.push({ industry: industryKey, field: t.field, url: t.url, ...r });
      const mark = r.status === 200 ? 'OK' : r.status === 'error' ? 'ERR' : `HTTP ${r.status}`;
      console.log(`[${industryKey}] ${t.field.padEnd(12)} ${String(mark).padEnd(8)} ${t.url}`);
    }
  }

  const bad = results.filter((r) => r.status === 'error' || (typeof r.status === 'number' && r.status >= 400));
  console.log('');
  console.log('===========================================');
  console.log(`Total probed : ${results.length}`);
  console.log(`OK           : ${results.length - bad.length}`);
  console.log(`Bad          : ${bad.length}`);
  if (bad.length > 0) {
    console.log('');
    console.log('Dead URLs (refresh candidates):');
    for (const r of bad) {
      console.log(`  [${r.industry}] ${r.field}  ${r.status}  ${r.url}`);
    }
    process.exit(1);
  }
}

void main();
