// =============================================================================
// Retry helper — exponential backoff with jitter.
//
// Phase 7 Session 1. Used by callExternal (which runs its own Result-classified
// loop and reaches for computeBackoffDelay + sleep), and exposed standalone via
// withRetry for ad-hoc retry of any throwing async function.
// =============================================================================

/** Tuning for a retry sequence. */
export type RetryConfig = {
  /** Total attempts, including the first. 3 = one try + two retries. */
  maxAttempts: number;
  /** Backoff base — the delay after attempt 1. */
  baseDelayMs: number;
  /** Backoff ceiling — no computed delay exceeds this. */
  maxDelayMs: number;
  /** When true, the delay is sampled in [0, computed] (full jitter) to spread
   *  retried load instead of synchronising every caller's retries. */
  jitter: boolean;
};

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 10_000,
  jitter: true,
};

/** Resolve after `ms` milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Exponential-backoff delay for a 1-indexed attempt that just failed:
 * attempt 1 → ~base, attempt 2 → ~2× base, attempt 3 → ~4× base, capped at
 * maxDelayMs. With jitter, the result is uniformly sampled in [0, computed].
 */
export function computeBackoffDelay(attempt: number, config: RetryConfig): number {
  const exponential = Math.min(
    config.baseDelayMs * 2 ** Math.max(0, attempt - 1),
    config.maxDelayMs,
  );
  return config.jitter ? Math.round(Math.random() * exponential) : exponential;
}

/**
 * Run a throwing async function with exponential-backoff retries. Ad-hoc helper
 * for retry needs outside callExternal (which retries on a Result classification
 * rather than on exceptions, so it does not use this).
 *
 * Retries while `shouldRetry(error)` is true and attempts remain; otherwise the
 * last error is rethrown. `fn` receives the 1-indexed attempt number.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options?: Partial<RetryConfig> & { shouldRetry?: (error: unknown) => boolean },
): Promise<T> {
  const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...options };
  const shouldRetry = options?.shouldRetry ?? (() => true);
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= config.maxAttempts || !shouldRetry(error)) break;
      await sleep(computeBackoffDelay(attempt, config));
    }
  }
  throw lastError;
}
