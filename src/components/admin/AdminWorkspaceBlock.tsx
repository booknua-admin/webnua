type AdminWorkspaceBlockProps = {
  label: string;
  name: string;
};

// Static block — there's only one workspace ("Webnua") right now. When/if
// multi-workspace lands this can grow into a real selector.
function AdminWorkspaceBlock({ label, name }: AdminWorkspaceBlockProps) {
  return (
    <div
      data-slot="admin-workspace-block"
      className="mx-[22px] mt-6 mb-5 rounded-lg border border-paper/[0.08] bg-paper/[0.04] px-4 py-3"
    >
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-paper/45">
        {`// ${label}`}
      </div>
      <div className="mt-1.5 text-sm font-bold text-paper">{name}</div>
    </div>
  );
}

export { AdminWorkspaceBlock };
