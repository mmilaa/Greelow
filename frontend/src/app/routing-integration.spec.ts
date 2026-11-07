import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Title } from '@angular/platform-browser';
import { routes } from './app.routes';
import { SessionRedirect } from './session-redirect';
import { AuthPort, type AuthUser, type LoginResult } from './features/auth/application/auth.port';
import { TokenStoragePort } from './features/auth/application/token-storage.port';
import { AccountPort } from './shared/application/account.port';
import { PendingTransfersPort } from './shared/application/pending-transfers.port';
import { TransactionPort } from './shared/application/transaction.port';
import { CategoryPort } from './features/transactions/application/category.port';
import { SessionStore } from './features/auth/application/session.store';
import { ApiErrorException } from './shared/domain/map-api-error';

const USER: AuthUser = { id: 'user-1', email: 'demo@example.com', name: 'Usuario Demo' };

class FakeTokenStorage extends TokenStoragePort {
  token: string | null = null;
  override get() {
    return this.token;
  }
  override set(t: string) {
    this.token = t;
  }
  override clear() {
    this.token = null;
  }
}

class FakeAuth extends AuthPort {
  meCalls = 0;
  meError: unknown = null;
  loginResult: LoginResult = { token: 'tok-1', user: USER };
  override async login(): Promise<LoginResult> {
    return this.loginResult;
  }
  override async me(): Promise<AuthUser> {
    this.meCalls += 1;
    if (this.meError) throw this.meError;
    return USER;
  }
}

function setup(initialToken: string | null, configure?: (auth: FakeAuth) => void) {
  const storage = new FakeTokenStorage();
  storage.token = initialToken;
  const auth = new FakeAuth();
  configure?.(auth);

  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      { provide: AuthPort, useValue: auth },
      { provide: TokenStoragePort, useValue: storage },
      // The accounts pages mount AccountsStore / AccountDetailStore on
      // navigation; give them fakes so the routing tests don't need the HTTP stack.
      { provide: AccountPort, useValue: { list: async () => [], create: async () => ({}) } },
      { provide: PendingTransfersPort, useValue: { pendingOutgoing: async () => [] } },
      { provide: TransactionPort, useValue: { list: async () => ({ items: [], page: 1, pageSize: 5, total: 0, totalPages: 0 }), create: async () => ({}) } },
      { provide: CategoryPort, useValue: { list: async () => [] } },
    ],
  });
  // Activate the expiry/logout redirect effect (normally hosted by App).
  TestBed.inject(SessionRedirect);
  return {
    auth,
    storage,
    session: TestBed.inject(SessionStore),
    router: TestBed.inject(Router),
  };
}

describe('routing (integration, real router + guards)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('without a session, visiting /accounts ends on /login with returnUrl', async () => {
    const { router } = setup(null);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/accounts');
    expect(router.url).toBe('/login?returnUrl=%2Faccounts');
  });

  it('with a valid token, /accounts stays put, calls /auth/me once, never hits /login', async () => {
    const { router, auth } = setup('tok-1');
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/accounts');
    expect(router.url).toBe('/accounts');
    expect(auth.meCalls).toBe(1);
  });

  it('with an invalid token, visiting /accounts ends on /login', async () => {
    const { router } = setup('bad-token', (auth) => {
      auth.meError = new ApiErrorException({ kind: 'unauthenticated' });
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/accounts');
    expect(router.url.startsWith('/login')).toBe(true);
  });

  it('sets the document title per route', async () => {
    setup('tok-1');
    const title = TestBed.inject(Title);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/accounts');
    expect(title.getTitle()).toBe('Cuentas');
    await harness.navigateByUrl('/transactions');
    expect(title.getTitle()).toBe('Movimientos');
    await harness.navigateByUrl('/transfers');
    expect(title.getTitle()).toBe('Transferencias');
  });



  it('if already authenticated, visiting /login redirects to /accounts', async () => {
    const { router } = setup('tok-1');
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/login');
    expect(router.url).toBe('/accounts');
  });

  it('logout from within a private page ends on /login without returnUrl, navigating once', async () => {
    const { router, session } = setup('tok-1');
    const navigateSpy = vi.spyOn(router, 'navigate');
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/accounts');
    expect(router.url).toBe('/accounts');

    session.logout();
    await harness.fixture.whenStable();

    expect(router.url).toBe('/login');
    // Only the effect navigates (the shell does not navigate on logout).
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });
});
