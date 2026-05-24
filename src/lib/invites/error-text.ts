// =============================================================================
// Friendly invite-error → human-readable mapping. Shared by both invite
// modals (operator team + client teammate) so the same error code reads the
// same in either flow.
// =============================================================================

const MAP: Record<string, string> = {
  'unauthenticated': 'You need to be signed in to send an invite. Refresh and try again.',
  'forbidden': "You don't have permission to do that.",
  'email-required': 'Add an email address before sending.',
  'email-invalid': "That doesn't look like a valid email.",
  'role-invalid': 'Pick a role before sending.',
  'junior-needs-clients': 'A junior operator needs at least one assigned client.',
  'invite-already-pending':
    'An invite to that address is already pending. Resend it from the Team tab instead.',
  'seat-limit-reached':
    "You've used every seat on your plan. Ask Webnua to add more before inviting another teammate.",
  'unknown-client': "We couldn't resolve that client. Refresh and try again.",
  'invite-failed': "We couldn't send the invite. Try again in a moment.",
  'invite-not-found': "We couldn't find that invite.",
  'client-required': "We couldn't tell which client this invite is for.",
};

export function humaniseInviteError(code: string): string {
  return MAP[code] ?? 'Something went wrong. Try again or contact support.';
}
