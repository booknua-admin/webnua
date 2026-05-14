type SidebarBrandProps = {
  meta: string;
};

function SidebarBrand({ meta }: SidebarBrandProps) {
  return (
    <div
      data-slot="sidebar-brand"
      className="mb-[22px] border-b border-paper/[0.08] px-[26px] pb-6"
    >
      <div className="flex items-center gap-2.5 text-2xl font-extrabold tracking-[-0.03em] text-paper">
        <span
          aria-hidden
          className="size-3 rotate-45 bg-rust"
          style={{ borderRadius: 2 }}
        />
        Webnua
      </div>
      <div className="mt-2 pl-[22px] font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-paper/45">
        {`// ${meta}`}
      </div>
    </div>
  );
}

export { SidebarBrand };
