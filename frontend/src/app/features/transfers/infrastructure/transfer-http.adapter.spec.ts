import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
});
