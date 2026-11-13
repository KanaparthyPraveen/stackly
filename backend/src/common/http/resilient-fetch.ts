/**
 * `fetch` with a timeout, bounded retries and exponential backoff.
 *
 * Every outbound call to a third-party provider goes through this helper so a
 * slow or rate-limiting provider can never hang a request or a background job.
 */

export interface ResilientFetchOptions extends RequestInit {
  /** Per-attempt timeout. */
  timeoutMs?: number;
  /** Additional attempts after the first one. */
  retries?: number;
  /** Base delay for exponential backoff. */
  backoffMs?: number;
  /** Upper bound for a single wait, including provider `Retry-After` hints. */
  maxDelayMs?: number;
}

/** Raised when the provider keeps rate limiting after all retries. */
export class ProviderRateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfterMs: number,
  ) {
    super(message);
    this.name = 'ProviderRateLimitError';
  }
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parses `Retry-After` (seconds or HTTP date) into milliseconds. */
export function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

export async function resilientFetch(
  url: string,
  options: ResilientFetchOptions = {},
): Promise<Response> {
  const {
    timeoutMs = 10_000,
    retries = 2,
    backoffMs = 400,
    maxDelayMs = 5_000,
    ...init
  } = options;

  // Only idempotent requests are retried automatically. A token exchange
  // (POST) must never be replayed: authorization codes are single-use.
  const method = (init.method ?? 'GET').toUpperCase();
  const attempts = method === 'GET' || method === 'HEAD' ? retries + 1 : 1;

  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const isLast = attempt === attempts - 1;
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!RETRYABLE_STATUS.has(response.status) || isLast) {
        if (response.status === 429) {
          const retryAfter = parseRetryAfter(
            response.headers.get('retry-after'),
          );
          throw new ProviderRateLimitError(
            'Provider rate limit reached',
            retryAfter ?? 60_000,
          );
        }
        return response;
      }

      const hinted = parseRetryAfter(response.headers.get('retry-after'));
      const wait = Math.min(hinted ?? backoffMs * 2 ** attempt, maxDelayMs);
      // Drain the body so the connection can be reused.
      await response.arrayBuffer().catch(() => undefined);
      await sleep(wait);
    } catch (err) {
      if (err instanceof ProviderRateLimitError) throw err;
      lastError = err;
      if (isLast) break;
      await sleep(Math.min(backoffMs * 2 ** attempt, maxDelayMs));
    }
  }

  const reason =
    lastError instanceof Error ? lastError.message : 'unknown error';
  throw new Error(`Request to ${new URL(url).host} failed: ${reason}`);
}
