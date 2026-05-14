import { Card, CardContent } from '@/components/ui/card';
import { Eyebrow } from '@/components/ui/eyebrow';

type SettingsTabPlaceholderProps = {
  tab: string;
  note?: string;
};

function SettingsTabPlaceholder({ tab, note }: SettingsTabPlaceholderProps) {
  return (
    <Card className="py-7">
      <CardContent className="flex flex-col gap-3 px-8 py-2">
        <Eyebrow tone="rust" bullet>
          {`// ${tab}`}
        </Eyebrow>
        <h2 className="text-[22px] font-extrabold tracking-[-0.02em] text-ink">
          Coming next session.
        </h2>
        <p className="text-[13px] leading-[1.5] text-ink-quiet">
          {note ??
            'This tab is wired but its content arrives with the rest of the settings sub-screens. The shell, nav, and active state above are the shared scaffolding — every tab plugs into them.'}
        </p>
        <div className="mt-3 rounded-lg border border-dashed border-rule bg-paper/60 px-4 py-3 text-[12px] text-ink-quiet">
          Placeholder — Session B fills this in.
        </div>
      </CardContent>
    </Card>
  );
}

export { SettingsTabPlaceholder };
