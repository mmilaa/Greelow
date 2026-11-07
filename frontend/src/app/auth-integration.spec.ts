import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { appProviders } from './app.config';
import { API_BASE_URL } from './core/config/api.config';
import { AccountPort } from './shared/application/account.port';
import { AuthPort } from './features/auth/application/auth.port';
import { SessionStore } from './features/auth/application/session.store';
import { TokenStoragePort } from './features/auth/application/token-storage.port';

const BASE = 'http://test-api';

/**
 * Integration test over the app's REAL providers (appProviders), swapping only
 * the HTTP backend for the testing one. If the interceptor or the
 * ON_UNAUTHENTICATED wiring is removed from app.config.ts, these tests fail.
 */
describe('auth wiring (integration, real appProviders)', () => {
  let httpMock: HttpTestingController;
  let accounts: AccountPort;
  let auth: AuthPort;
  let session: SessionStore;
  let tokens: TokenStoragePort;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...appProviders,
        // Swap only the HTTP backend and pin the base URL for the test.
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
      ],
    });
    accounts = TestBed.inject(AccountPort);
    auth = TestBed.inject(AuthPort);
    session = TestBed.inject(SessionStore);
    tokens = TestBed.inject(TokenStoragePort);
    httpMock = TestBed.inject(HttpTestingController);
    tokens.clear();
  });

  afterEach(() => {
    httpMock.verify();
    tokens.clear();
  });

  it('attaches the Authorization header to an API request', async () => {
    tokens.set('tok-1');
    const promise = accounts.list();
    const req = httpMock.expectOne(`${BASE}/accounts`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok-1');
    req.flush({ accounts: [] });
    await promise;
  });

  it('a 401 outside login expires the session (wiring is connected)', async () => {
    tokens.set('tok-1');
    // Reach an authenticated session first.
    const loginPromise = session.login('demo@example.com', 'demo123');
    httpMock
      .expectOne(`${BASE}/auth/login`)
      .flush({ token: 'tok-1', user: { id: 'user-1', email: 'demo@example.com', name: 'Usuario Demo' } });
    await loginPromise;
    expect(session.isAuthenticated()).toBe(true);

    const promise = accounts.list();
    httpMock
      .expectOne(`${BASE}/accounts`)
      .flush({ error: 'Invalid token' }, { status: 401, statusText: 'Unauthorized' });

    await expect(promise).rejects.toMatchObject({ error: { kind: 'unauthenticated' } });
    expect(session.session().status).toBe('anonymous');
    expect(tokens.get()).toBeNull();
  });

  it('a 401 on login (bad credentials) does NOT clear the session or an existing token', async () => {
    // A stale token exists before the login attempt.
    tokens.set('old-token');

    const promise = auth.login('demo@example.com', 'wrong');
    httpMock
      .expectOne(`${BASE}/auth/login`)
      .flush({ error: 'Invalid email or password' }, { status: 401, statusText: 'Unauthorized' });

    await expect(promise).rejects.toMatchObject({ error: { kind: 'invalid-credentials' } });
    // invalid-credentials is not unauthenticated: the token is untouched.
    expect(tokens.get()).toBe('old-token');
    expect(session.session().status).toBe('anonymous');
  });
});
