// =============================================================================
// callExternal() — the single wrapper for every outbound integration call.
//
// Phase 7 Session 1. Every Phase 7 integration makes its external HTTP calls
// through this function. It handles, in one place:
//   • Timeout (AbortController; default 30s, configurable per call).
//   • Retry on 5xx and network errors with exponential backoff (default 3
//     attempts, configurable per call).
//   • Structured logging of every attempt to integration_call_log.
//   • Error classification — retryable / non_retryable / auth_failed /
//     rate_limited.
//   • A typed Result<T, IntegrationError> discriminated union.
//
// Optimised for the 80% case — JSON in, JSON out. The 20% (non-JSON body,
// non-JSON response) is served by the `rawBody` and `parseResponse` escape
// hatches; no caller should need to drop to bare fetch.
//
// SERVER-ONLY — logging writes integration_call_log with the service-role
// client.
// =============================================================================

import {
  getIntegrationDb,
  type IntegrationCallDirection,
  type IntegrationCallErrorClass,
  type IntegrationCallLogInsert,
} from './db-types';
import { computeBackoffDelay, DEFAULT_RETRY_CONFIG, sleep, type RetryConfig } from './retry';

// --- result + error types ----------------------------------------------------

/** How a failed call should be treated by the caller. */
export type IntegrationErrorClass = IntegrationCallErrorClass;

/** A failed external call. `class` drives the caller's handling; `status` /
 *  `body` are populated when the provider returned an HTTP response; `cause`
 *  is populated when no response happened (network error / timeout). */
export type IntegrationError = {
  class: IntegrationErrorClass;
  message: string;
  provider: string;
  operation: string;
  status?: number;
  body?: unknown;
  cause?: unknown;
};

/** The discriminated outcome of callExternal. */
export type IntegrationResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: IntegrationError };

// --- options -----------------------------------------------------------------

export type CallExternalOptions = {
  /** Provider slug, e.g. 'vercel' / 'stripe'. Logged; used in errors. */
  provider: string;
  /** Operation slug, e.g. 'add_project_domain'. Logged; used in errors. */
  operation: string;
  url: string;
  /** Defaults to POST when a body is given, GET otherwise. */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Request headers. NEVER logged — this is where auth tokens live. */
  headers?: Record<string, string>;
  /** JSON-serialised as the request body. Ignored when `rawBody` is set. */
  body?: unknown;
  /** Escape hatch: a non-JSON request body. Wins over `body`; set the matching
   *  Content-Type yourself in `headers`. */
  rawBody?: BodyInit;
  /** Escape hatch: parse a non-JSON response. Default tries JSON, falls back
   *  to the raw text. */
  parseResponse?: (response: Response) => Promise<unknown>;
  /** Per-call timeout. Default 30_000ms. */
  timeoutMs?: number;
  /** Per-call retry tuning. Merged over DEFAULT_RETRY_CONFIG. */
  retry?: Partial<RetryConfig>;
  /** 'outbound' (default) or 'inbound' — recorded on the call-log row. */
  direction?: IntegrationCallDirection;
  /** Tenant attribution for the call-log row. NULL = platform-level call. */
  clientId?: string | null;
  /** Trace id linking this call to its siblings. Generated if omitted. */
  correlationId?: string;
  /** Override the default redaction applied to request/response shapes before
   *  they are written to integration_call_log. */
  redact?: (shape: unknown) => unknown;
};

const DEFAULT_TIMEOUT_MS = 30_000;

// --- public API --------------------------------------------------------------

/**
 * Make an external HTTP call with timeout, retry, classification and logging.
 *
 * Retries (with exponential backoff) on network errors, timeouts and 5xx
 * responses. 401/403 → auth_failed (not retried). 429 → rate_limited (not
 * retried — the caller decides). Other 4xx → non_retryable. Every attempt is
 * logged to integration_call_log.
 */
export async function callExternal<T = unknown>(
  options: CallExternalOptions,
): Promise<IntegrationResult<T>> {
  const { provider, operation, url } = options;
  const direction = options.direction ?? 'outbound';
  const clientId = options.clientId ?? null;
  const correlationId = options.correlationId ?? crypto.randomUUID();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retry: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...options.retry };
  const redact = options.redact ?? defaultRedact;

  // Build the request once — the same bytes go out on every retry.
  const headers: Record<string, string> = { ...options.headers };
  let bodyInit: BodyInit | undefined;
  let requestShape: unknown = null;
  if (options.rawBody !== undefined) {
    bodyInit = options.rawBody;
    requestShape = { rawBody: true };
  } else if (options.body !== undefined) {
    bodyInit = JSON.stringify(options.body);
    if (!hasHeader(headers, 'content-type')) headers['Content-Type'] = 'application/json';
    requestShape = redact(options.body);
  }
  const method = options.method ?? (bodyInit !== undefined ? 'POST' : 'GET');

  let lastError: IntegrationError = {
    class: 'retryable',
    message: 'no attempt was made',
    provider,
    operation,
  };

  for (let attempt = 1; attempt <= retry.maxAttempts; attempt++) {
    const startedAt = Date.now();
    let response: Response | null = null;
    let networkError: unknown = null;

    try {
      response = await fetchWithTimeout(url, { method, headers, body: bodyInit }, timeoutMs);
    } catch (error) {
      networkError = error;
    }
    const latencyMs = Date.now() - startedAt;

    // --- no response: network error / timeout (retryable) -------------------
    if (!response) {
      const isAbort = networkError instanceof Error && networkError.name === 'AbortError';
      const error: IntegrationError = {
        class: 'retryable',
        message: isAbort
          ? `request timed out after ${timeoutMs}ms`
          : `network error: ${errorMessage(networkError)}`,
        provider,
        operation,
        cause: networkError,
      };
      logCall({
        provider,
        operation,
        direction,
        clientId,
        correlationId,
        requestShape,
        responseStatus: null,
        responseShape: null,
        latencyMs,
        errorClass: error.class,
        errorMessage: error.message,
      });
      lastError = error;
      if (attempt < retry.maxAttempts) {
        await sleep(computeBackoffDelay(attempt, retry));
        continue;
      }
      return { ok: false, error };
    }

    // --- got a response -----------------------------------------------------
    const parsed = await parseBody(response, options.parseResponse);
    const responseShape = redact(parsed);

    if (response.ok) {
      logCall({
        provider,
        operation,
        direction,
        clientId,
        correlationId,
        requestShape,
        responseStatus: response.status,
        responseShape,
        latencyMs,
        errorClass: null,
        errorMessage: null,
      });
      return { ok: true, data: parsed as T, status: response.status };
    }

    const errorClass = classifyStatus(response.status);
    const error: IntegrationError = {
      class: errorClass,
      message: extractProviderMessage(parsed) ?? `${provider} responded ${response.status}`,
      provider,
      operation,
      status: response.status,
      body: parsed,
    };
    logCall({
      provider,
      operation,
      direction,
      clientId,
      correlationId,
      requestShape,
      responseStatus: response.status,
      responseShape,
      latencyMs,
      errorClass,
      errorMessage: error.message,
    });
    lastError = error;
    // Only 5xx (classified retryable) is retried; auth/rate-limit/other-4xx
    // are returned to the caller immediately.
    if (errorClass === 'retryable' && attempt < retry.maxAttempts) {
      await sleep(computeBackoffDelay(attempt, retry));
      continue;
    }
    return { ok: false, error };
  }

  // Unreachable — the loop always returns — but keeps the type checker honest.
  return { ok: false, error: lastError };
}

// --- internals ---------------------------------------------------------------

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function parseBody(
  response: Response,
  custom?: (response: Response) => Promise<unknown>,
): Promise<unknown> {
  if (custom) return custom(response);
  const text = await response.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function classifyStatus(status: number): IntegrationErrorClass {
  if (status === 401 || status === 403) return 'auth_failed';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'retryable';
  return 'non_retryable';
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const lower = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === lower);
}

function errorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  return typeof value === 'string' ? value : 'unknown error';
}

/** Pull a human message out of a provider's JSON error body — the common
 *  shapes are `{ error: { message } }`, `{ message }`, `{ error }`,
 *  `{ detail }`. Returns undefined when nothing useful is found. */
function extractProviderMessage(parsed: unknown): string | undefined {
  if (typeof parsed === 'string') return parsed.slice(0, 500) || undefined;
  if (parsed === null || typeof parsed !== 'object') return undefined;
  const obj = parsed as Record<string, unknown>;
  const nested = obj.error;
  if (nested !== null && typeof nested === 'object') {
    const msg = (nested as Record<string, unknown>).message;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
  }
  for (const key of ['message', 'error', 'detail', 'error_description'] as const) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

const SECRET_KEY_RE =
  /secret|token|password|api[-_]?key|authorization|bearer|credential|cookie|signature/i;

/** Recursively blank values under secret-looking keys before a request/response
 *  shape is written to integration_call_log. Bounded in depth and array width
 *  so a pathological body cannot blow up the log row. */
function defaultRedact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[truncated]';
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => defaultRedact(item, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEY_RE.test(key) ? '[redacted]' : defaultRedact(val, depth + 1);
  }
  return out;
}

/** Coerce a value to something jsonb-safe (drops undefined / functions / cycles
 *  by round-tripping). Returns null when it cannot be serialised. */
function jsonSafe(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

type CallLogEntry = {
  provider: string;
  operation: string;
  direction: IntegrationCallDirection;
  clientId: string | null;
  correlationId: string;
  requestShape: unknown;
  responseStatus: number | null;
  responseShape: unknown;
  latencyMs: number;
  errorClass: IntegrationErrorClass | null;
  errorMessage: string | null;
};

/** Fire-and-forget write of one attempt to integration_call_log. Observability
 *  must never block — or fail — the call it is recording. */
function logCall(entry: CallLogEntry): void {
  void (async () => {
    try {
      const row: IntegrationCallLogInsert = {
        provider: entry.provider,
        operation: entry.operation,
        direction: entry.direction,
        request_shape: jsonSafe(entry.requestShape),
        response_status: entry.responseStatus,
        response_shape: jsonSafe(entry.responseShape),
        latency_ms: entry.latencyMs,
        error_class: entry.errorClass,
        error_message: entry.errorMessage,
        client_id: entry.clientId,
        correlation_id: entry.correlationId,
      };
      const { error } = await getIntegrationDb().from('integration_call_log').insert(row);
      if (error) {
        console.warn('[callExternal] integration_call_log insert failed', error.message);
      }
    } catch (error) {
      console.warn('[callExternal] integration_call_log write threw', error);
    }
  })();
}
