// =============================================================================
// AppError + Result — the platform's data-access error contract.
//
// Design rationale: reference/backend-schema-design.md §8.
//
// Every data-access boundary handles failure one of two ways:
//   - returns a `Result<T>` — imperative call sites (server actions, mutations
//     invoked outside React Query, anywhere you want explicit `.ok` handling);
//   - throws an `AppError` — inside a TanStack Query `queryFn`/`mutationFn`,
//     where React Query catches the throw and exposes it as a typed `error`.
//
// Throwing a plain `Error` is reserved for genuine programmer error — a broken
// invariant that should crash loudly — never for an expected failure.
// =============================================================================

/**
 * The closed set of failure kinds. Each maps to a front-end response:
 *  - auth        not signed in / session expired      → route to /login
 *  - forbidden   signed in, RLS/capability rejected    → CapabilityGate affordance / toast
 *  - not_found   row absent OR invisible under RLS     → "not found" (the two are
 *                                                        deliberately indistinguishable —
 *                                                        RLS must not leak existence)
 *  - validation  input failed a schema/registry check  → field-level messages
 *  - conflict    optimistic-concurrency clash          → "someone else edited this" toast
 *  - unexpected  anything else                         → generic toast + logged
 */
export type AppErrorKind =
  | 'auth'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'conflict'
  | 'unexpected';

/** The other editor in an optimistic-concurrency conflict (design doc §3.1 /
 *  §8 — last-write-wins, reported not blocked). */
export type ConflictInfo = {
  userId: string;
  displayName: string;
  /** ISO 8601 timestamp of their write. */
  at: string;
};

type AppErrorDetail = {
  /** `validation` only — field key → human message. */
  fields?: Record<string, string>;
  /** `conflict` only — who else wrote. */
  conflictWith?: ConflictInfo;
  /** `unexpected` — the original thrown value, for logging. */
  cause?: unknown;
};

/**
 * The single platform error type. A class extending `Error` so it throws
 * cleanly through TanStack Query, error boundaries, and logging — while `kind`
 * keeps it a discriminated value for `Result<T>` handling.
 *
 * Construct via the static factories (`AppError.forbidden()`, …) rather than
 * `new` so call sites stay terse and the per-kind payload contract is enforced.
 */
export class AppError extends Error {
  readonly kind: AppErrorKind;
  /** Set iff `kind === 'validation'`. */
  readonly fields?: Readonly<Record<string, string>>;
  /** Set iff `kind === 'conflict'`. */
  readonly conflictWith?: ConflictInfo;

  constructor(kind: AppErrorKind, message: string, detail?: AppErrorDetail) {
    super(message, detail?.cause !== undefined ? { cause: detail.cause } : undefined);
    this.name = 'AppError';
    this.kind = kind;
    // Conditional assignment so a `validation`/`conflict` payload is present
    // only on the matching kind — and never written as a literal `undefined`
    // (keeps the type honest under `exactOptionalPropertyTypes`).
    if (detail?.fields) this.fields = detail.fields;
    if (detail?.conflictWith) this.conflictWith = detail.conflictWith;
  }

  static auth(message = 'Please sign in to continue.'): AppError {
    return new AppError('auth', message);
  }

  static forbidden(message = "You don't have permission to do that."): AppError {
    return new AppError('forbidden', message);
  }

  static notFound(message = "That doesn't exist, or isn't available to you."): AppError {
    return new AppError('not_found', message);
  }

  static validation(
    fields: Record<string, string>,
    message = 'Some fields need attention.',
  ): AppError {
    return new AppError('validation', message, { fields });
  }

  static conflict(
    conflictWith: ConflictInfo,
    message = 'Someone else edited this while you were working.',
  ): AppError {
    return new AppError('conflict', message, { conflictWith });
  }

  static unexpected(cause?: unknown, message = 'Something went wrong.'): AppError {
    return new AppError('unexpected', message, { cause });
  }
}

/** Type guard — narrows an unknown caught value to `AppError`. */
export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/**
 * Coerce any thrown value into an `AppError`. An `AppError` passes through
 * untouched; an infrastructure error (Supabase / PostgREST) is mapped by its
 * code; anything else becomes `unexpected`.
 *
 * Scope note: this maps the stable, unambiguous infrastructure codes only.
 * `validation` and `conflict` are never produced here — they are
 * application-detected (a registry check; an `updated_at` clash) and
 * constructed explicitly at the call site that holds the field / identity
 * context. The code table is refined against real errors when the Supabase
 * client is wired in Phase 3.
 */
export function normalizeError(value: unknown): AppError {
  if (isAppError(value)) return value;

  if (value !== null && typeof value === 'object') {
    const e = value as { code?: unknown; status?: unknown; message?: unknown };
    const message = typeof e.message === 'string' && e.message.length > 0 ? e.message : undefined;

    // Supabase Auth errors carry an HTTP status.
    if (e.status === 401) return AppError.auth(message);
    if (e.status === 403) return AppError.forbidden(message);

    // PostgREST / Postgres error codes.
    if (typeof e.code === 'string') {
      switch (e.code) {
        case 'PGRST116': // .single() matched no rows — absent or RLS-hidden
          return AppError.notFound(message);
        case '42501': {
          // insufficient_privilege — an RLS policy or trigger rejected the
          // write. The 0106 client-self-manage triggers raise this with a
          // verbose message ("clients may only edit body and subject on
          // their own automation actions (attempted change to
          // action_config.X)"). Surface the friendlier rewrite — the raw
          // text is operator-debug noise to a client.
          if (typeof message === 'string' && /clients may only/i.test(message)) {
            return AppError.forbidden(
              "You can only edit the message body and subject. Other settings are managed by your operator — open a ticket if you'd like one changed.",
            );
          }
          return AppError.forbidden(message);
        }
      }
    }
  }

  return AppError.unexpected(value, extractErrorMessage(value));
}

/** Best-effort: surface a real diagnostic message from an unknown value
 *  instead of falling through to "Something went wrong." Walks the common
 *  shapes (Supabase `{ message, details, hint, code }`, fetch response
 *  envelope, plain Error). Returns the default sentinel if nothing useful
 *  is found, so AppError.unexpected's own default kicks in. */
function extractErrorMessage(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value || undefined;
  if (typeof value !== 'object') return undefined;
  const e = value as {
    message?: unknown;
    error?: unknown;
    details?: unknown;
    hint?: unknown;
    code?: unknown;
  };
  const parts: string[] = [];
  if (typeof e.message === 'string' && e.message.trim()) parts.push(e.message.trim());
  else if (typeof e.error === 'string' && e.error.trim()) parts.push(e.error.trim());
  if (typeof e.details === 'string' && e.details.trim()) parts.push(e.details.trim());
  if (typeof e.hint === 'string' && e.hint.trim()) parts.push(`(${e.hint.trim()})`);
  if (typeof e.code === 'string' && e.code.trim() && parts.length > 0) {
    parts.push(`[${e.code.trim()}]`);
  }
  return parts.length > 0 ? parts.join(' — ') : undefined;
}

// --- Result --------------------------------------------------------------------

/** Discriminated success/failure value — the return shape for imperative
 *  data-access call sites. (TanStack Query call sites throw `AppError`
 *  instead; see the module header.) */
export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err(error: AppError): Result<never> {
  return { ok: false, error };
}

/** Run a throwing async op and capture the outcome as a `Result`. Any thrown
 *  value is run through `normalizeError`. */
export async function toResult<T>(op: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await op());
  } catch (caught) {
    return err(normalizeError(caught));
  }
}
