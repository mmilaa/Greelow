import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TransactionPort } from '../../../shared/application/transaction.port';
import { CategoryPort } from '../application/category.port';
import { TransactionHttpAdapter, CategoryHttpAdapter } from './transaction-http.adapter';
import { API_BASE_URL } from '../../../core/config/api.config';
import { Money } from '../../../shared/domain/money';

const BASE = 'http://test-api';

function expenseDto(overrides: Record<string, unknown> = {}) {
  return {
    id: 'txn-1',
    accountId: 'acc-1',
    type: 'expense',
    direction: null,
    amount: 5000,
    currency: 'ARS',
    category: 'groceries',
    description: 'Super',
    status: 'completed',
    counterpartAccountId: null,
    transferId: null,
    createdAt: '2026-10-20T16:00:00Z',
    ...overrides,
  };
}

describe('TransactionHttpAdapter', () => {
  let port: TransactionPort;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        { provide: TransactionPort, useClass: TransactionHttpAdapter },
      ],
    });
    port = TestBed.inject(TransactionPort);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('builds query params and omits undefined ones (case D)', async () => {
    const promise = port.list({ accountId: 'acc-1', status: 'completed', page: 2, pageSize: 10 });
    const req = httpMock.expectOne(
      (r) => r.url === `${BASE}/transactions`,
    );
    expect(req.request.params.get('accountId')).toBe('acc-1');
    expect(req.request.params.get('status')).toBe('completed');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('10');
    expect(req.request.params.has('category')).toBe(false);
    expect(req.request.params.has('search')).toBe(false);
    req.flush({ transactions: [expenseDto()], pagination: { page: 2, pageSize: 10, total: 11 } });

    const result = await promise;
    expect(result.items).toHaveLength(1);
    expect(result.totalPages).toBe(2);
  });

  it('posts the amount as a decimal and maps the response (case E)', async () => {
    const promise = port.create({
      accountId: 'acc-1',
      type: 'expense',
      amount: Money.fromMinor(1234, 'ARS'),
      category: 'groceries',
    });
    const req = httpMock.expectOne(`${BASE}/transactions`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      accountId: 'acc-1',
      type: 'expense',
      amount: 12.34,
      category: 'groceries',
    });
    // The API wraps the created resource: { transaction: { ... } } (see
    // docs/api-samples/10,37,41). The adapter must unwrap it before mapping.
    req.flush({ transaction: expenseDto({ amount: 12.34 }) });

    const txn = await promise;
    expect(txn.amount.toDecimal()).toBe(12.34);
  });

  it('maps a 422 on create to insufficient-funds only for transfers, so here it is unknown', async () => {
    // create-transaction context: a 422 is not insufficient-funds.
    const promise = port.create({ accountId: 'acc-1', type: 'income', amount: Money.fromDecimal(1, 'ARS') });
    const req = httpMock.expectOne(`${BASE}/transactions`);
    req.flush({ error: 'something' }, { status: 422, statusText: 'Unprocessable Entity' });

    await expect(promise).rejects.toMatchObject({ error: { kind: 'unknown', status: 422 } });
  });
});

describe('CategoryHttpAdapter', () => {
  let port: CategoryPort;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        { provide: CategoryPort, useClass: CategoryHttpAdapter },
      ],
    });
    port = TestBed.inject(CategoryPort);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('maps the flat categories array (case I)', async () => {
    const promise = port.list();
    const req = httpMock.expectOne(`${BASE}/categories`);
    req.flush({ categories: ['salary', 'groceries', 'other'] });

    const categories = await promise;
    expect(categories).toEqual(['salary', 'groceries', 'other']);
  });
});
