import Link from 'next/link';

export type ClientSupportContact = {
  label: string;
  org: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
};

type ClientSupportCardProps = {
  contact: ClientSupportContact;
};

function ClientSupportCard({ contact }: ClientSupportCardProps) {
  return (
    <div
      data-slot="client-support-card"
      className="mx-[22px] mt-6 mb-5 rounded-lg border border-paper/[0.08] bg-paper/[0.04] p-4"
    >
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-paper/45">
        {`// ${contact.label}`}
      </div>
      <div className="mt-2 text-sm font-bold text-paper">{contact.org}</div>
      <p className="mt-1 text-[12px] leading-snug text-paper/60">
        {contact.description}
      </p>
      <Link
        href={contact.ctaHref}
        className="mt-3 inline-flex font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-rust-light hover:text-rust"
      >
        {contact.ctaLabel} →
      </Link>
    </div>
  );
}

export { ClientSupportCard };
