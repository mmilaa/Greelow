/**
 * Transfer settlement decision: a pure function that, given the observed status
 * of a transfer and how many polls have been made, decides the next step.
 *
 * Pure TypeScript: no `@angular/*` imports, no timers. The application layer
 * owns the polling schedule; this module only decides.
 */

/**
 * Status observed for a transfer while polling.
 *
 * `pending` | `completed` | `failed` come from the API (transfer.status).
 * `unknown` is produced by the application layer when a poll request itself
 * fails (network error, 500). It is NOT a transfer outcome: we simply could not
 * read the status, so it is treated like `pending`.
 */
export type TransferStatus = 'pending' | 'completed' | 'failed' | 'unknown';

/** What to do after observing a transfer status. */
export type SettlementStep = 'confirmed' | 'failed' | 'retry' | 'unconfirmed';

/** Settlement polling parameters. `intervalMs` is consumed by the application layer. */
export interface SettlementConfig {
  readonly maxAttempts: number;
  readonly intervalMs: number;
}

/**
 * Defaults: poll every second, up to 6 attempts. The API settles in ~1.5s, so
 * this leaves a comfortable window without polling forever.
 */
export const DEFAULT_SETTLEMENT_CONFIG: SettlementConfig = {
  maxAttempts: 6,
  intervalMs: 1000,
};

/**
 * Decides the next settlement step.
 *
 * - `completed` -> `confirmed`
 * - `failed` -> `failed`
 * - `pending` / `unknown` with attempts remaining -> `retry`
 * - `pending` / `unknown` with attempts exhausted -> `unconfirmed`
 *
 * A terminal status (`completed`/`failed`) wins even on the last attempt.
 *
 * @param status       the observed status (`unknown` means the poll failed)
 * @param attemptsDone how many polls have already been made
 * @param config       settlement parameters
 */
export function nextSettlementStep(
  status: TransferStatus,
  attemptsDone: number,
  config: SettlementConfig,
): SettlementStep {
  if (status === 'completed') {
    return 'confirmed';
  }
  if (status === 'failed') {
    return 'failed';
  }
  // pending or unknown: keep trying while attempts remain.
  return attemptsDone < config.maxAttempts ? 'retry' : 'unconfirmed';
}
