type SidebarUserProps = {
  initial: string;
  name: string;
  role: string;
};

function SidebarUser({ initial, name, role }: SidebarUserProps) {
  return (
    <div
      data-slot="sidebar-user"
      className="mt-auto border-t border-paper/[0.08] px-[26px] pt-5"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-paper/10 font-sans text-sm font-extrabold text-paper">
          {initial}
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-bold text-paper">{name}</div>
          <div className="mt-0.5 truncate font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-paper/45">
            {`// ${role}`}
          </div>
        </div>
      </div>
    </div>
  );
}

export { SidebarUser };
