import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { AccountPort } from '../application/account.port';
import { AccountHttpAdapter } from './account-http.adapter';
import { API_BASE_URL } from '../../../core/config/api.config';
import { ApiErrorException } from '../../../shared/domain/map-api-error';

const BASE = 'http://test-api';

describe('AccountHttpAdapter', () => {
  let port: AccountPort;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        { provide: AccountPort, useClass: AccountHttpAdapter },
      ],
    });
    port = TestBed.inject(AccountPort);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('hits the base URL and maps the accounts (case H)', async () => {
    const promise = port.list();
    const req = httpMock.expectOne(`${BASE}/accounts`);
    expect(req.request.method).toBe('GET');
    req.flush({
      accounts: [
        { id: 'acc-1', userId: 'user-1', name: 'Cuenta Pesos', currency: 'ARS', balance: 855000 },
      ],
    });

    const accounts = await promise;
    expect(accounts).toHaveLength(1);
    expect(accounts[0].balance.toDecimal()).toBe(855000);
  });

  it('maps status 0 to a network ApiErrorException (case G)', async () => {
    const promise = port.list();
    const req = httpMock.expectOne(`${BASE}/accounts`);
    req.error(new ProgressEvent('error'), { status: 0, statusText: '' });

    await expect(promise).rejects.toMatchObject({ error: { kind: 'network' } });
    await expect(promise).rejects.toBeInstanceOf(ApiErrorException);
  });

  it('raises invalid-response when a 200 body is corrupt (case F)', async () => {
    const promise = port.list();
    const req = httpMock.expectOne(`${BASE}/accounts`);
    // balance is not a number -> mapAccount throws InvalidDataError -> invalid-response.
    req.flush({ accounts: [{ id: 'acc-1', name: 'x', currency: 'ARS', balance: 'oops' }] });

    await expect(promise).rejects.toMatchObject({ error: { kind: 'invalid-response' } });
  });
});
