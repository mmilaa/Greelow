import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { SessionStore } from './session.store';
import { AuthPort, type AuthUser, type LoginResult } from './auth.port';
import { TokenStoragePort } from './token-storage.port';
import { ApiErrorException } from '../../../shared/domain/map-api-error';

const USER: AuthUser = { id: 'user-1', email: 'demo@example.com', name: 'Usuario Demo' };

class FakeTokenStorage extends TokenStoragePort {
  token: string | null = null;
  override get() {
    return this.token;
  }
  override set(token: string) {
    this.token = token;
  }
  override clear() {
    this.token = null;
  }
}

/** Configurable fake auth port. */
class FakeAuth extends AuthPort {
  loginResult: LoginResult = { token: 'fake-token-user-1', user: USER };
  loginError: unknown = null;
  meResult: AuthUser = USER;
  meError: unknown = null;
  meCalls = 0;

  override async login(): Promise<LoginResult> {
    if (this.loginError) throw this.loginError;
    return this.loginResult;
  }
  override async me(): Promise<AuthUser> {
    this.meCalls += 1;
    if (this.meError) throw this.meError;
    return this.meResult;
  }
}

function setup(configure?: (auth: FakeAuth, storage: FakeTokenStorage) => void) {
  const auth = new FakeAuth();
  const storage = new FakeTokenStorage();
  configure?.(auth, storage);
  TestBed.configureTestingModule({
    providers: [
      SessionStore,
      { provide: AuthPort, useValue: auth },
      { provide: TokenStoragePort, useValue: storage },
    ],
  });
  const store = TestBed.inject(SessionStore);
  return { store, auth, storage };
}

describe('SessionStore', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('starts anonymous', () => {
    const { store } = setup();
    expect(store.session().status).toBe('anonymous');
    expect(store.isAuthenticated()).toBe(false);
  });

  it('login stores the token and authenticates', async () => {
    const { store, storage } = setup();
    const user = await store.login('demo@example.com', 'demo123');
    expect(user).toEqual(USER);
    expect(storage.get()).toBe('fake-token-user-1');
    expect(store.isAuthenticated()).toBe(true);
    expect(store.user()).toEqual(USER);
  });

  it('login with invalid credentials does not touch the session', async () => {
    const { store, storage } = setup((auth) => {
      auth.loginError = new ApiErrorException({ kind: 'invalid-credentials' });
    });
    await expect(store.login('demo@example.com', 'wrong')).rejects.toMatchObject({
      error: { kind: 'invalid-credentials' },
    });
    expect(store.session().status).toBe('anonymous');
    expect(storage.get()).toBeNull();
  });

  it('rehydrates from a valid token via /auth/me', async () => {
    const { store } = setup((_auth, storage) => {
      storage.token = 'fake-token-user-1';
    });
    await store.ensureInitialized();
    expect(store.isAuthenticated()).toBe(true);
    expect(store.user()).toEqual(USER);
  });

  it('does not call /auth/me when there is no stored token', async () => {
    const { store, auth } = setup();
    await store.ensureInitialized();
    expect(auth.meCalls).toBe(0);
    expect(store.session().status).toBe('anonymous');
  });

  it('clears the token and goes anonymous when /auth/me is unauthorized', async () => {
    const { store, storage } = setup((auth, s) => {
      s.token = 'bad-token';
      auth.meError = new ApiErrorException({ kind: 'unauthenticated' });
    });
    await store.ensureInitialized();
    expect(store.session().status).toBe('anonymous');
    expect(storage.get()).toBeNull();
  });

  it('keeps the token (and does not cache) when /auth/me fails transiently', async () => {
    const { store, storage, auth } = setup((a, s) => {
      s.token = 'fake-token-user-1';
      a.meError = new ApiErrorException({ kind: 'network' });
    });
    await store.ensureInitialized();
    expect(store.session().status).toBe('anonymous');
    expect(storage.get()).toBe('fake-token-user-1'); // not cleared
    expect(auth.meCalls).toBe(1);

    // A later call retries (not cached) and can succeed.
    auth.meError = null;
    await store.ensureInitialized();
    expect(store.isAuthenticated()).toBe(true);
    expect(auth.meCalls).toBe(2);
  });

  it('calls /auth/me only once for concurrent ensureInitialized calls', async () => {
    const { store, auth } = setup((_a, s) => {
      s.token = 'fake-token-user-1';
    });
    await Promise.all([store.ensureInitialized(), store.ensureInitialized(), store.ensureInitialized()]);
    expect(auth.meCalls).toBe(1);
  });

  it('logout clears everything', async () => {
    const { store, storage } = setup();
    await store.login('demo@example.com', 'demo123');
    store.logout();
    expect(store.session().status).toBe('anonymous');
    expect(storage.get()).toBeNull();
  });

  it('expire is idempotent: several calls expire only once', async () => {
    const { store, storage } = setup();
    await store.login('demo@example.com', 'demo123');
    store.expire();
    store.expire();
    store.expire();
    expect(store.session().status).toBe('anonymous');
    expect(storage.get()).toBeNull();
  });
});
