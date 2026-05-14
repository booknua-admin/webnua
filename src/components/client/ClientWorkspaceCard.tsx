type ClientWorkspaceCardProps = {
  initial: string;
  name: string;
  status: string;
};

function ClientWorkspaceCard({
  initial,
  name,
  status,
}: ClientWorkspaceCardProps) {
  return (
    <div
      data-slot="client-workspace-card"
      className="mx-[22px] mb-[22px] flex items-center gap-3 rounded-lg border border-rust/30 bg-rust/10 px-4 py-3.5"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-rust font-sans text-base font-extrabold text-paper">
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-bold leading-tight text-paper">
          {name}
        </div>
        <div className="mt-[3px] flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-paper/60">
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-good"
            style={{ background: '#5cba6e' }}
          />
          {status}
        </div>
      </div>
    </div>
  );
}

export { ClientWorkspaceCard };
