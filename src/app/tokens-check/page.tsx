/*
 * THROWAWAY — Phase 2 design-token sanity page.
 * Delete this folder once tokens have been visually confirmed.
 */

type Swatch = {
  name: string;
  hex: string;
  className: string;
  textClassName?: string;
};

const surfaces: Swatch[] = [
  { name: 'paper', hex: '#f5f1ea', className: 'bg-paper', textClassName: 'text-ink' },
  { name: 'paper-2', hex: '#ebe5d9', className: 'bg-paper-2', textClassName: 'text-ink' },
  { name: 'paper-3', hex: '#e0d8c8', className: 'bg-paper-3', textClassName: 'text-ink' },
];

const inks: Swatch[] = [
  { name: 'ink', hex: '#0a0a0a', className: 'bg-ink', textClassName: 'text-paper' },
  { name: 'ink-soft', hex: '#2a2a28', className: 'bg-ink-soft', textClassName: 'text-paper' },
  { name: 'ink-mid', hex: '#4a4a45', className: 'bg-ink-mid', textClassName: 'text-paper' },
  { name: 'muted', hex: '#6e685c', className: 'bg-muted', textClassName: 'text-paper' },
];

const accents: Swatch[] = [
  { name: 'accent', hex: '#d24317', className: 'bg-accent', textClassName: 'text-paper' },
  {
    name: 'accent-light',
    hex: '#e8743b',
    className: 'bg-accent-light',
    textClassName: 'text-paper',
  },
  { name: 'accent-soft', hex: '#f4dccd', className: 'bg-accent-soft', textClassName: 'text-ink' },
  { name: 'rust', hex: '#8a3815', className: 'bg-rust', textClassName: 'text-paper' },
];

const states: Swatch[] = [
  { name: 'good', hex: '#1e6b3a', className: 'bg-good', textClassName: 'text-paper' },
  { name: 'good-soft', hex: '#d3e8d8', className: 'bg-good-soft', textClassName: 'text-ink' },
  { name: 'warn', hex: '#c44444', className: 'bg-warn', textClassName: 'text-paper' },
  { name: 'warn-soft', hex: '#f4d4d4', className: 'bg-warn-soft', textClassName: 'text-ink' },
  { name: 'info', hex: '#2d7d8a', className: 'bg-info', textClassName: 'text-paper' },
  { name: 'info-soft', hex: '#d4dde8', className: 'bg-info-soft', textClassName: 'text-ink' },
];

const rules: Swatch[] = [
  { name: 'rule', hex: '#c9c0b0', className: 'bg-rule', textClassName: 'text-ink' },
  { name: 'rule-soft', hex: '#d8d0bf', className: 'bg-rule-soft', textClassName: 'text-ink' },
];

function SwatchGrid({ items }: { items: Swatch[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((s) => (
        <div
          key={s.name}
          className={`${s.className} ${s.textClassName ?? 'text-ink'} rounded-xl p-4 h-28 flex flex-col justify-between border border-rule-soft`}
        >
          <div className="font-mono text-[10px] tracking-[0.12em] uppercase opacity-70">
            {s.name}
          </div>
          <div className="font-mono text-xs">{s.hex}</div>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-accent mb-3">
        {title}
      </div>
      {children}
    </section>
  );
}

export default function TokensCheckPage() {
  const radii: { name: string; cls: string }[] = [
    { name: 'xs (2px)', cls: 'rounded-xs' },
    { name: 'sm (4px)', cls: 'rounded-sm' },
    { name: 'md (6px)', cls: 'rounded-md' },
    { name: 'default (8px)', cls: 'rounded' },
    { name: 'lg (10px)', cls: 'rounded-lg' },
    { name: 'xl (12px)', cls: 'rounded-xl' },
    { name: '2xl (14px)', cls: 'rounded-2xl' },
    { name: '3xl (16px)', cls: 'rounded-3xl' },
    { name: 'pill (100px)', cls: 'rounded-pill' },
    { name: 'full (999px)', cls: 'rounded-full' },
  ];

  const typeScale: { label: string; cls: string; weight: string }[] = [
    { label: 'Display 30 / 700 / -0.025em', cls: 'text-[30px] leading-[1.1]', weight: '700' },
    { label: 'Display 28 / 800 / -0.025em', cls: 'text-[28px] leading-[1.1]', weight: '800' },
    { label: 'H 24 / 700', cls: 'text-[24px] leading-[1.2]', weight: '700' },
    { label: 'H 22 / 700', cls: 'text-[22px] leading-[1.2]', weight: '700' },
    { label: 'H 18 / 600', cls: 'text-[18px] leading-[1.3]', weight: '600' },
    { label: 'Body 16 / 500', cls: 'text-[16px] leading-[1.5]', weight: '500' },
    { label: 'Body 14 / 500', cls: 'text-[14px] leading-[1.5]', weight: '500' },
    { label: 'Small 13 / 500', cls: 'text-[13px] leading-[1.5]', weight: '500' },
    { label: 'Small 12 / 600', cls: 'text-[12px] leading-[1.5]', weight: '600' },
  ];

  return (
    <main className="bg-paper text-ink min-h-screen px-8 py-10 max-w-5xl mx-auto">
      <header className="mb-10 pb-6 border-b border-rule">
        <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-accent mb-2">
          phase 02 · sanity page
        </div>
        <h1 className="text-[30px] font-bold tracking-[-0.025em] mb-2">
          Webnua design tokens — <em className="not-italic text-accent">eyeball pass</em>
        </h1>
        <p className="text-sm text-ink-mid max-w-[640px]">
          Renders every token defined in <code className="font-mono">globals.css</code> against
          the prototype values in <code className="font-mono">reference/</code>. Compare,
          confirm, delete this page.
        </p>
      </header>

      <Section title="Surfaces">
        <SwatchGrid items={surfaces} />
      </Section>

      <Section title="Ink + muted">
        <SwatchGrid items={inks} />
      </Section>

      <Section title="Accent (rust)">
        <SwatchGrid items={accents} />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div
            className="rounded-xl p-4 h-28 flex flex-col justify-between text-paper border border-rule-soft"
            style={{ background: '#d24317' }}
          >
            <div className="font-mono text-[10px] tracking-[0.12em] uppercase opacity-80">
              accent · CLAUDE.md
            </div>
            <div className="font-mono text-xs">#d24317</div>
          </div>
          <div
            className="rounded-xl p-4 h-28 flex flex-col justify-between text-paper border border-rule-soft"
            style={{ background: '#d45b1a' }}
          >
            <div className="font-mono text-[10px] tracking-[0.12em] uppercase opacity-80">
              accent · prototype (reference only)
            </div>
            <div className="font-mono text-xs">#d45b1a</div>
          </div>
        </div>
        <p className="font-mono text-[11px] tracking-[0.06em] text-muted mt-3">
          CLAUDE.md mandates the left. Sanity-check the difference is acceptable.
        </p>
      </Section>

      <Section title="Semantic states">
        <SwatchGrid items={states} />
        <p className="font-mono text-[11px] tracking-[0.06em] text-muted mt-3">
          Note: <code>info-soft</code> #d4dde8 was originally paired with platform&rsquo;s blue
          info. We&rsquo;re using teal info per CLAUDE.md — flag if the soft pairing looks off.
        </p>
      </Section>

      <Section title="Rules / hairlines">
        <SwatchGrid items={rules} />
      </Section>

      <Section title="Radii">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {radii.map((r) => (
            <div key={r.name} className="flex flex-col items-center gap-2">
              <div className={`${r.cls} bg-ink w-16 h-16`} />
              <div className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-mid">
                {r.name}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Shadows">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 py-4">
          <div className="bg-paper-2 rounded-xl p-6 shadow-card">
            <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-mid">
              shadow-card
            </div>
          </div>
          <div className="bg-accent rounded-xl p-6 text-paper shadow-glow">
            <div className="font-mono text-[10px] tracking-[0.12em] uppercase opacity-80">
              shadow-glow
            </div>
          </div>
          <div className="bg-paper rounded-xl p-6 shadow-ring border border-rule">
            <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-mid">
              shadow-ring (focus)
            </div>
          </div>
        </div>
      </Section>

      <Section title="Type scale · Inter Tight">
        <div className="space-y-3">
          {typeScale.map((t) => (
            <div key={t.label} className={t.cls} style={{ fontWeight: t.weight }}>
              <span style={{ letterSpacing: '-0.025em' }}>The quick brown rust fox</span>
              <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-muted ml-3">
                {t.label}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Inter Tight weights">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[400, 500, 600, 700, 800, 900].map((w) => (
            <div key={w} className="text-[20px]" style={{ fontWeight: w }}>
              Webnua {w}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Mono · eyebrow, data, technical labels">
        <div className="space-y-3 font-mono">
          <div className="text-[10px] tracking-[0.14em] uppercase text-accent">
            eyebrow tag · 10 / 0.14em
          </div>
          <div className="text-[11px] tracking-[0.1em] uppercase text-ink-mid">
            section label · 11 / 0.1em
          </div>
          <div className="text-[12px] tracking-[0.06em] text-ink">
            data row · 12 / 0.06em · 42.7%
          </div>
          <div className="text-[14px] text-ink">
            inline code · 14 · const accent = &lsquo;#d24317&rsquo;;
          </div>
        </div>
      </Section>

      <Section title="Composition · prototype's most common pattern">
        <div className="border border-rule rounded-xl p-6 bg-paper-2 max-w-md">
          <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-accent mb-2">
            audit · stage 01
          </div>
          <h2 className="text-[24px] font-bold tracking-[-0.025em] mb-2">
            Read the page like a <em className="not-italic text-accent">customer would</em>
          </h2>
          <p className="text-[14px] text-ink-mid mb-4">
            We pull the brand, the offer, the friction. You confirm. The proof page builds from
            this audit.
          </p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] tracking-[0.12em] uppercase bg-good-soft text-good px-2 py-1 rounded">
              ready
            </span>
            <span className="font-mono text-[10px] tracking-[0.12em] uppercase bg-warn-soft text-warn px-2 py-1 rounded">
              needs review
            </span>
            <span className="font-mono text-[10px] tracking-[0.12em] uppercase bg-info-soft text-info px-2 py-1 rounded">
              info
            </span>
          </div>
        </div>
      </Section>

      <footer className="mt-12 pt-6 border-t border-rule font-mono text-[10px] tracking-[0.12em] uppercase text-muted">
        delete /tokens-check before the phase 02 commit
      </footer>
    </main>
  );
}
