function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Retries an async operation on failure, with exponential backoff. Sarvam's
 * API is occasionally flaky — including intermittent auth rejections on
 * genuinely valid keys that can persist for several seconds — and these
 * calls are otherwise a dead end for the user — a plain "click Transcribe
 * again" is the only recourse today. Confirmed via direct testing that
 * identical calls from the same process at the same moment can fail then
 * immediately succeed, so this is upstream flakiness, not a local bug.
 */
async function withRetry(fn, { attempts = 4, delayMs = 2000, maxDelayMs = 12000, onRetry } = {}) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) {
        const delay = Math.min(delayMs * 2 ** i, maxDelayMs);
        onRetry?.(error, i + 1, delay);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

module.exports = { withRetry };
