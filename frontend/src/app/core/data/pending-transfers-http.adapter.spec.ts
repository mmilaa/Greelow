import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { PendingTransfersPort } from '../../shared/application/pending-transfers.port';
import { PendingTransfersHttpAdapter } from './pending-transfers-http.adapter';
import { API_BASE_URL } from '../config/api.config';

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

describe('PendingTransfersHttpAdapter', () => {
  let port: PendingTransfersPort;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        { provide: PendingTransfersPort, useClass: PendingTransfersHttpAdapter },
      ],
    });
    port = TestBed.inject(PendingTransfersPort);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('fetches a single page when total fits, filtering pending transfers without accountId', async () => {
    const promise = port.pendingOutgoing();
    const req = httpMock.expectOne((r) => r.url === `${BASE}/transactions`);
    expect(req.request.params.get('status')).toBe('pending');
    expect(req.request.params.get('type')).toBe('transfer');
    expect(req.request.params.has('accountId')).toBe(false);
    req.flush({
      transactions: [leg(), leg({ id: 't2', accountId: 'acc-2' })],
      pagination: { page: 1, pageSize: 50, total: 2 },
    });

    const pending = await promise;
    expect(pending).toHaveLength(2);
    expect(pending[0].direction).toBe('out');
    expect(pending[1].accountId).toBe('acc-2');
  });

  function waitForPage(page: number) {
    return vi.waitFor(() =>
      httpMock.expectOne(
        (r) => r.url === `${BASE}/transactions` && r.params.get('page') === String(page),
      ),
    );
  }

  async function flushPage(page: number, count: number, total: number): Promise<void> {
    const req = await waitForPage(page);
    expect(req.request.params.has('accountId')).toBe(false);
    req.flush({
      transactions: Array.from({ length: count }, (_, i) => leg({ id: `p${page}-${i}` })),
      pagination: { page, pageSize: 50, total },
    });
  }

  it('fetches all pages when total exceeds one page', async () => {
    const promise = port.pendingOutgoing();
    await flushPage(1, 50, 120);
    await flushPage(2, 50, 120);
    await flushPage(3, 20, 120);

    const pending = await promise;
    expect(pending).toHaveLength(120);
  });

  it('throws without a partial list if a page fails mid-pagination', async () => {
    const promise = port.pendingOutgoing();
    await flushPage(1, 50, 120);

    const page2 = await waitForPage(2);
    page2.error(new ProgressEvent('error'), { status: 0, statusText: '' });

    await expect(promise).rejects.toMatchObject({ error: { kind: 'network' } });
  });

  it('throws invalid-response and stops at the page cap on an absurd total', async () => {
    const promise = port.pendingOutgoing();
    for (let page = 1; page <= 20; page++) {
      await flushPage(page, 50, Number.MAX_SAFE_INTEGER);
    }

    await expect(promise).rejects.toMatchObject({ error: { kind: 'invalid-response' } });
    httpMock.expectNone((r) => r.url === `${BASE}/transactions` && r.params.get('page') === '21');
  });
});
