import { cn } from '@/lib/utils';

type Invoice = {
  id: string;
  date: string;
  description: string;
  amount: string;
  status: 'paid' | 'pending' | 'failed';
};

type InvoiceListProps = {
  invoices: Invoice[];
  className?: string;
};

const statusLabel: Record<Invoice['status'], string> = {
  paid: 'Paid',
  pending: 'Pending',
  failed: 'Failed',
};

const statusClass: Record<Invoice['status'], string> = {
  paid: 'text-good',
  pending: 'text-rust',
  failed: 'text-warn',
};

function InvoiceList({ invoices, className }: InvoiceListProps) {
  return (
    <div
      data-slot="invoice-list"
      className={cn('mt-3 overflow-hidden rounded-lg border border-rule bg-paper', className)}
    >
      <div
        data-slot="invoice-header"
        className="grid grid-cols-[120px_1fr_90px_100px_80px] gap-3.5 border-b border-rule bg-paper-2 px-[18px] py-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet"
      >
        <span>Date</span>
        <span>Description</span>
        <span>Amount</span>
        <span>Status</span>
        <span />
      </div>
      {invoices.map((inv) => (
        <div
          key={inv.id}
          data-slot="invoice-row"
          className="grid grid-cols-[120px_1fr_90px_100px_80px] items-center gap-3.5 border-b border-paper-2 bg-card px-[18px] py-3 text-[13px] text-ink last:border-b-0"
        >
          <span className="font-mono text-[11px] tracking-[0.04em] text-ink-quiet">{inv.date}</span>
          <span>{inv.description}</span>
          <span className="font-extrabold">{inv.amount}</span>
          <span
            className={cn(
              'font-mono text-[10px] font-bold uppercase tracking-[0.08em]',
              statusClass[inv.status],
            )}
          >
            {statusLabel[inv.status]}
          </span>
          <span className="cursor-pointer text-right text-[11px] font-bold text-rust">PDF ↓</span>
        </div>
      ))}
    </div>
  );
}

export { InvoiceList };
export type { Invoice };
