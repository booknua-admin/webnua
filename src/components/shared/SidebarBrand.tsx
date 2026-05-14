import { BrandMark } from '@/components/ui/BrandMark';

type SidebarBrandProps = {
  meta: string;
};

function SidebarBrand({ meta }: SidebarBrandProps) {
  return (
    <div
      data-slot="sidebar-brand"
      className="mb-[22px] border-b border-paper/[0.08] px-[26px] pb-6"
    >
      <BrandMark className="text-paper" />
      <div className="mt-2 pl-[22px] font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-paper/45">
        {`// ${meta}`}
      </div>
    </div>
  );
}

export { SidebarBrand };
