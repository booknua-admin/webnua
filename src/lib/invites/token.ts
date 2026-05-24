// =============================================================================
// Invite token generation — opaque random URL-safe id used as the path
// segment in the magic-link URL `{appBase}/invite/{token}`. Persisted on
// `team_invites.token` / `client_user_invites.token` (unique-indexed) so the
// GET /api/invites/[token] route resolves the row with a single lookup.
//
// 32 random bytes → base64url ≈ 43 characters. 256 bits of entropy is well
// past anything brute-forceable; the unique index also prevents collisions.
// We don't HMAC-sign these (unlike the OAuth state token) — DB lookup is
// the source of truth and the row's `expires_at` / `consumed_at` columns
// drive the validity check, so a signed payload would add nothing.
//
// SERVER-ONLY (uses node:crypto).
// =============================================================================

import { randomBytes } from 'node:crypto';

/** Build a fresh opaque invite token. URL-safe, 32 bytes of entropy. */
export function generateInviteToken(): string {
  return randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Compose the public magic-link URL the email body carries. */
export function composeInviteUrl(appBase: string, token: string): string {
  const trimmed = appBase.replace(/\/+$/, '');
  return `${trimmed}/invite/${encodeURIComponent(token)}`;
}
