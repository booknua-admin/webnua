import { Eyebrow } from '@/components/ui/eyebrow';

type PagePlaceholderProps = {
  eyebrow: string;
  title: string;
  description?: string;
};

function PagePlaceholder({
  eyebrow,
  title,
  description,
}: PagePlaceholderProps) {
  return (
    <div
      data-slot="page-placeholder"
      className="flex flex-1 flex-col gap-3 px-10 py-12"
    >
      <Eyebrow tone="rust">{`// ${eyebrow}`}</Eyebrow>
      <h1 className="text-4xl font-extrabold tracking-[-0.03em] text-ink">
        {title}
      </h1>
      {description ? (
        <p className="max-w-2xl text-base text-ink-quiet">{description}</p>
      ) : null}
      <div className="mt-6 rounded-lg border border-dashed border-rule bg-paper-2/40 p-8 text-sm text-ink-quiet">
        Placeholder page — wiring only. Real content arrives in a later phase.
      </div>
    </div>
  );
}

export { PagePlaceholder };
