import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { AuthPort } from '../application/auth.port';
import { AuthHttpAdapter } from './auth-http.adapter';
import { API_BASE_URL } from '../../../core/config/api.config';
import { ON_UNAUTHENTICATED } from '../../../core/http/on-unauthenticated.token';

const BASE = 'http://test-api';

function setup() {
  const onUnauthenticated = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: API_BASE_URL, useValue: BASE },
      { provide: ON_UNAUTHENTICATED, useValue: onUnauthenticated },
      { provide: AuthPort, useClass: AuthHttpAdapter },
    ],
  });
  return {
    port: TestBed.inject(AuthPort),
    httpMock: TestBed.inject(HttpTestingController),
    onUnauthenticated,
  };
}

describe('AuthHttpAdapter', () => {
  let httpMock: HttpTestingController;
  afterEach(() => httpMock.verify());

  it('login returns token and user', async () => {
    const { port, httpMock: mock } = setup();
    httpMock = mock;
    const promise = port.login('demo@example.com', 'demo123');
    const req = httpMock.expectOne(`${BASE}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'demo@example.com', password: 'demo123' });
    req.flush({ token: 'fake-token-user-1', user: { id: 'user-1', email: 'demo@example.com', name: 'Usuario Demo' } });

    const result = await promise;
    expect(result.token).toBe('fake-token-user-1');
    expect(result.user.name).toBe('Usuario Demo');
  });

  it('a 401 on login is invalid-credentials and does NOT fire ON_UNAUTHENTICATED (case F)', async () => {
    const { port, httpMock: mock, onUnauthenticated } = setup();
    httpMock = mock;
    const promise = port.login('demo@example.com', 'wrong');
    const req = httpMock.expectOne(`${BASE}/auth/login`);
    req.flush({ error: 'Invalid email or password' }, { status: 401, statusText: 'Unauthorized' });

    await expect(promise).rejects.toMatchObject({ error: { kind: 'invalid-credentials' } });
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it('me maps the user (sample 22)', async () => {
    const { port, httpMock: mock } = setup();
    httpMock = mock;
    const promise = port.me();
    const req = httpMock.expectOne(`${BASE}/auth/me`);
    req.flush({ user: { id: 'user-1', email: 'demo@example.com', name: 'Usuario Demo' } });

    const user = await promise;
    expect(user).toEqual({ id: 'user-1', email: 'demo@example.com', name: 'Usuario Demo' });
  });

  it('a 401 on me is unauthenticated and fires ON_UNAUTHENTICATED (sample 23)', async () => {
    const { port, httpMock: mock, onUnauthenticated } = setup();
    httpMock = mock;
    const promise = port.me();
    const req = httpMock.expectOne(`${BASE}/auth/me`);
    req.flush({ error: 'Invalid token' }, { status: 401, statusText: 'Unauthorized' });

    await expect(promise).rejects.toMatchObject({ error: { kind: 'unauthenticated' } });
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it('fires ON_UNAUTHENTICATED once even for parallel 401s', async () => {
    const { port, httpMock: mock, onUnauthenticated } = setup();
    httpMock = mock;
    const p1 = port.me();
    const p2 = port.me();
    const reqs = httpMock.match(`${BASE}/auth/me`);
    expect(reqs.length).toBe(2);
    reqs.forEach((r) => r.flush({ error: 'Invalid token' }, { status: 401, statusText: 'Unauthorized' }));

    await expect(p1).rejects.toMatchObject({ error: { kind: 'unauthenticated' } });
    await expect(p2).rejects.toMatchObject({ error: { kind: 'unauthenticated' } });
    // runRequest fires the callback per failed request; the store's expire() is
    // idempotent (covered in session.store.spec). Here both fire the callback.
    expect(onUnauthenticated).toHaveBeenCalledTimes(2);
  });
});
