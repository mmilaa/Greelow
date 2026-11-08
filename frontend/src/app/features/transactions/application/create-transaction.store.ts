import { Injectable, computed, inject, signal } from '@angular/core';
import {
  TransactionPort,
  type CreateTransactionInput,
} from '../../../shared/application/transaction.port';
import { type Transaction } from '../../../shared/domain/transaction';
import { ApiErrorException, type ApiError } from '../../../shared/domain/map-api-error';

/** State of the create-transaction submission. */
export type CreateState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'error'; error: ApiError };

/**
 * Submits a new income/expense. Guards against double submit (a second call
 * while submitting is ignored). Reuses TransactionPort.create; the request body
 * is built by the infrastructure mapper. On failure it exposes the typed
 * ApiError so the page can highlight fields (validation) or show the
 * uncertain-result message (network / invalid-response).
 *
 * Signals + inject (allowed in application); no browser, HTTP or Router.
 */
@Injectable()
export class CreateTransactionStore {
  private readonly transactions = inject(TransactionPort);

  private readonly stateSig = signal<CreateState>({ status: 'idle' });

  readonly state = this.stateSig.asReadonly();
  readonly submitting = computed(() => this.stateSig().status === 'submitting');

  /**
   * Creates the transaction. Returns the created Transaction on success, or
   * null if it failed (the error is on the state) or was ignored as a double
   * submit. Never rejects.
   */
  async submit(input: CreateTransactionInput): Promise<Transaction | null> {
    if (this.stateSig().status === 'submitting') {
      return null; // guard against double submit
    }
    this.stateSig.set({ status: 'submitting' });
    try {
      const created = await this.transactions.create(input);
      this.stateSig.set({ status: 'idle' });
      return created;
    } catch (err) {
      this.stateSig.set({ status: 'error', error: toApiError(err) });
      return null;
    }
  }
}

/** Normalizes any thrown value to a typed ApiError. */
function toApiError(err: unknown): ApiError {
  if (err instanceof ApiErrorException) {
    return err.error;
  }
  return { kind: 'unknown', status: 0 };
}
