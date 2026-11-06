import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TransferPort } from '../application/transfer.port';
import { TransferHttpAdapter } from './transfer-http.adapter';
import { API_BASE_URL } from '../../../core/config/api.config';
import { Money } from '../../../shared/domain/money';

const BASE = 'http://test-api';

function leg(overrides: Record<string, unknown> = {}) {
  return {
    id: 'transfer-1-out',
    accountId: 'acc-1',
    type: 'transfer',
    direction: 'out',
    amount: 100,
    currency: 'ARS',
    category: 'transfer',
    description: 'x',
    status: 'pending',
    counterpartAccountId: 'acc-4',
    transferId: 'transfer-1',
    createdAt: '2026-11-05T15:58:31.245Z',
    ...overrides,
  };
}

describe('TransferHttpAdapter', () => {
  let port: TransferPort;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        { provide: TransferPort, useClass: TransferHttpAdapter },
      ],
    });
    port = TestBed.inject(TransferPort);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('posts the amount as a decimal and maps the transfer (case E)', async () => {
    const promise = port.create({
      fromAccountId: 'acc-1',
      toAccountId: 'acc-2',
      amount: Money.fromDecimal(5000, 'ARS'),
    });
    const req = httpMock.expectOne(`${BASE}/transfers`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ fromAccountId: 'acc-1', toAccountId: 'acc-2', amount: 5000 });
    req.flush({ id: 'transfer-1', status: 'pending', from: leg(), to: null });

    const transfer = await promise;
    expect(transfer.id).toBe('transfer-1');
    expect(transfer.status).toBe('pending');
  });

  it('maps a 422 on create to insufficient-funds', async () => {
    const promise = port.create({
      fromAccountId: 'acc-1',
      toAccountId: 'acc-2',
      amount: Money.fromDecimal(5000, 'ARS'),
    });
    const req = httpMock.expectOne(`${BASE}/transfers`);
    req.flush(
      { error: 'Insufficient funds in source account' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    await expect(promise).rejects.toMatchObject({ error: { kind: 'insufficient-funds' } });
  });

  it('getById fetches and maps a transfer', async () => {
    const promise = port.getById('transfer-1');
    const req = httpMock.expectOne(`${BASE}/transfers/transfer-1`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'transfer-1', status: 'completed', from: leg({ status: 'completed' }), to: null });

    const transfer = await promise;
    expect(transfer.status).toBe('completed');
  });

  describe('pendingOutgoing', () => {
    it('fetches a single page when total fits (case B)', async () => {
      const promise = port.pendingOutgoing('acc-1');
      const req = httpMock.expectOne((r) => r.url === `${BASE}/transactions`);
      expect(req.request.params.get('status')).toBe('pending');
      expect(req.request.params.get('type')).toBe('transfer');
      expect(req.request.params.get('accountId')).toBe('acc-1');
      req.flush({ transactions: [leg(), leg({ id: 't2' })], pagination: { page: 1, pageSize: 50, total: 2 } });

      const pending = await promise;
      expect(pending).toHaveLength(2);
      expect(pending[0].direction).toBe('out');
    });

    // Waits (retrying) until the request for a given page is issued, then returns it.
    // Pagination is sequential, so each request only appears after the previous resolves.
    function waitForPage(page: number) {
      return vi.waitFor(() =>
        httpMock.expectOne(
          (r) => r.url === `${BASE}/transactions` && r.params.get('page') === String(page),
        ),
      );
    }

    async function flushPage(page: number, count: number, total: number): Promise<void> {
      const req = await waitForPage(page);
      req.flush({
        transactions: Array.from({ length: count }, (_, i) => leg({ id: `p${page}-${i}` })),
        pagination: { page, pageSize: 50, total },
      });
    }

    it('fetches all pages when total exceeds one page (case A)', async () => {
      const promise = port.pendingOutgoing('acc-1');
      await flushPage(1, 50, 120);
      await flushPage(2, 50, 120);
      await flushPage(3, 20, 120);

      const pending = await promise;
      expect(pending).toHaveLength(120);
    });

    it('throws without a partial list if a page fails mid-pagination', async () => {
      const promise = port.pendingOutgoing('acc-1');
      await flushPage(1, 50, 120);

      const page2 = await waitForPage(2);
      page2.error(new ProgressEvent('error'), { status: 0, statusText: '' });

      await expect(promise).rejects.toMatchObject({ error: { kind: 'network' } });
    });

    it('throws invalid-response and stops at the page cap on an absurd total', async () => {
      const promise = port.pendingOutgoing('acc-1');
      // Every page is full and claims an impossibly large total, so the loop
      // would never finish: it must stop at the 20-page cap and throw.
      for (let page = 1; page <= 20; page++) {
        await flushPage(page, 50, Number.MAX_SAFE_INTEGER);
      }

      await expect(promise).rejects.toMatchObject({ error: { kind: 'invalid-response' } });
      // No 21st request is ever issued.
      httpMock.expectNone((r) => r.url === `${BASE}/transactions` && r.params.get('page') === '21');
    });
  });
});
