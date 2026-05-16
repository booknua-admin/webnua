import {
  ALL_CAPABILITIES,
  CAPABILITY_LABEL,
} from '@/lib/auth/capabilities';
import { CAP_EXPLAINER } from '@/lib/auth/explainers';
import { TEAM_ROLE_CAPABILITIES, type TeamRole } from '@/lib/team/roles';

type PermissionPreviewProps = {
  role: TeamRole;
  heading: React.ReactNode;
  description: React.ReactNode;
};

// Allow/deny is COMPUTED from the capability layer — never a hand-written
// list. The chosen role's capability set partitions ALL_CAPABILITIES.
function PermissionPreview({ role, heading, description }: PermissionPreviewProps) {
  const granted = new Set(TEAM_ROLE_CAPABILITIES[role]);
  const allow = ALL_CAPABILITIES.filter((cap) => granted.has(cap));
  const deny = ALL_CAPABILITIES.filter((cap) => !granted.has(cap));

  return (
    <div className="mb-3.5 rounded-[10px] border border-rule bg-paper px-5 py-[18px]">
      <div className="mb-1 font-sans text-[14px] font-extrabold text-ink">
        {heading}
      </div>
      <div className="mb-3.5 font-sans text-[12px] leading-[1.5] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
        {description}
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <div className="flex flex-col gap-1.5">
          <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-good">
            {'// Allow'}
          </div>
          {allow.map((cap) => (
            <div
              key={cap}
              className="flex items-center gap-2 py-1 font-sans text-[12px] text-ink"
            >
              <span className="w-4 text-center text-[13px] font-extrabold text-good">
                ✓
              </span>
              {CAPABILITY_LABEL[cap]}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-warn">
            {'// Deny'}
          </div>
          {deny.length > 0 ? (
            deny.map((cap) => (
              <div
                key={cap}
                title={CAP_EXPLAINER[cap].short}
                className="flex items-center gap-2 py-1 font-sans text-[12px] text-ink"
              >
                <span className="w-4 text-center text-[13px] font-extrabold text-warn">
                  ✗
                </span>
                {CAPABILITY_LABEL[cap]}
              </div>
            ))
          ) : (
            <div className="py-1 font-sans text-[12px] italic text-ink-quiet">
              Full builder access — nothing denied.
            </div>
          )}
        </div>
      </div>

      {role !== 'junior' ? (
        <p className="mt-3.5 border-t border-paper-2 pt-3 font-sans text-[11px] leading-[1.5] text-ink-quiet">
          Owner and Operator share full builder access. They differ on billing
          and workspace governance, which isn&apos;t part of this view.
        </p>
      ) : null}
    </div>
  );
}

export { PermissionPreview };
export type { PermissionPreviewProps };
