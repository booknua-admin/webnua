'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';

type PreviewDevice = 'desktop' | 'mobile';

type PreviewPanelBarProps = {
  domain: string;
  className?: string;
  defaultDevice?: PreviewDevice;
};

function PreviewPanelBar({
  domain,
  className,
  defaultDevice = 'desktop',
}: PreviewPanelBarProps) {
  const [device, setDevice] = useState<PreviewDevice>(defaultDevice);

  return (
    <div
      data-slot="preview-panel-bar"
      className={cn(
        'flex items-center justify-between border-b border-rule bg-paper-2 px-4.5 py-3 font-mono text-[11px] tracking-[0.06em] text-ink-quiet',
        className,
      )}
    >
      <span
        data-slot="preview-panel-tag"
        className="inline-flex items-center gap-2 font-bold text-rust before:size-1.5 before:animate-pulse before:rounded-full before:bg-good before:content-['']"
      >
        ● Live · {domain}
      </span>
      <div className="flex gap-1">
        <PreviewTab
          active={device === 'desktop'}
          onClick={() => setDevice('desktop')}
        >
          Desktop
        </PreviewTab>
        <PreviewTab
          active={device === 'mobile'}
          onClick={() => setDevice('mobile')}
        >
          Mobile
        </PreviewTab>
      </div>
    </div>
  );
}

type PreviewTabProps = {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function PreviewTab({ active, onClick, children }: PreviewTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-md px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em]',
        active ? 'bg-ink text-paper' : 'text-ink-quiet hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

export { PreviewPanelBar };
