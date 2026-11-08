import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CreateTransactionStore } from './create-transaction.store';
import {
  TransactionPort,
  type CreateTransactionInput,
} from '../../../shared/application/transaction.port';
import { type Transaction } from '../../../shared/domain/transaction';
import { Money } from '../../../shared/domain/money';
import { ApiErrorException } from '../../../shared/domain/map-api-error';

function createdTxn(): Transaction {
  return {
    id: 'txn-new', accountId: 'acc-1', type: 'expense', direction: null, status: 'completed',
    amount: Money.fromDecimal(100, 'ARS'), category: 'groceries', description: 'x',
    counterpartAccountId: null, transferId: null, createdAt: '2026-11-07T10:00:00Z',
  };
}

const input: CreateTransactionInput = {
  accountId: 'acc-1',
  type: 'expense',
  amount: Money.fromDecimal(100, 'ARS'),
};

class FakeTransactionPort extends TransactionPort {
  createCalls = 0;
  createError: unknown = null;
  lastInput: CreateTransactionInput | null = null;
  override async list(): Promise<never> {
    throw new Error('not used');
  }
  override async create(i: CreateTransactionInput): Promise<Transaction> {
    this.createCalls += 1;
    this.lastInput = i;
    if (this.createError) throw this.createError;
    return createdTxn();
  }
}

function setup() {
  const port = new FakeTransactionPort();
  TestBed.configureTestingModule({
    providers: [CreateTransactionStore, { provide: TransactionPort, useValue: port }],
  });
  return { store: TestBed.inject(CreateTransactionStore), port };
}

describe('CreateTransactionStore', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('submits and returns the created transaction, back to idle', async () => {
    const { store, port } = setup();
    const created = await store.submit(input);
    expect(created?.id).toBe('txn-new');
    expect(port.createCalls).toBe(1);
    expect(port.lastInput).toEqual(input);
    expect(store.state().status).toBe('idle');
  });

  it('is submitting while the request is in flight', async () => {
    const { store, port } = setup();
    let release!: () => void;
    vi.spyOn(port, 'create').mockImplementation(async () => {
      await new Promise<void>((r) => (release = r));
      return createdTxn();
    });
    const p = store.submit(input);
    expect(store.submitting()).toBe(true);
    release();
    await p;
    expect(store.submitting()).toBe(false);
  });

  it('ignores a second submit while the first is in flight (single create)', async () => {
    const { store, port } = setup();
    let release!: () => void;
    vi.spyOn(port, 'create').mockImplementation(async () => {
      await new Promise<void>((r) => (release = r));
      return createdTxn();
    });
    const first = store.submit(input);
    const second = await store.submit(input); // ignored while submitting
    expect(second).toBeNull();
    release();
    await first;
    expect(port.create).toHaveBeenCalledTimes(1);
  });

  it('exposes a validation ApiError on a 400', async () => {
    const { store, port } = setup();
    port.createError = new ApiErrorException({ kind: 'validation', fields: [{ field: 'category', message: 'x' }] });
    const r = await store.submit(input);
    expect(r).toBeNull();
    const s = store.state();
    expect(s.status).toBe('error');
    if (s.status === 'error') expect(s.error.kind).toBe('validation');
  });

  it('exposes a network ApiError (uncertain result)', async () => {
    const { store, port } = setup();
    port.createError = new ApiErrorException({ kind: 'network' });
    await store.submit(input);
    const s = store.state();
    if (s.status !== 'error') throw new Error('expected error');
    expect(s.error.kind).toBe('network');
  });

  it('normalizes a non-API error to unknown', async () => {
    const { store, port } = setup();
    port.createError = new Error('boom');
    await store.submit(input);
    const s = store.state();
    if (s.status !== 'error') throw new Error('expected error');
    expect(s.error.kind).toBe('unknown');
  });
});
