import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { authGuard, safeReturnUrl } from './auth.guard';
import { SessionStore } from '../application/session.store';

/** Minimal session store double. */
class FakeSession {
  authenticated = false;
  initCalls = 0;
  async ensureInitialized() {
    this.initCalls += 1;
    return this.authenticated ? { status: 'authenticated' } : { status: 'anonymous' };
  }
  isAuthenticated() {
    return this.authenticated;
  }
}

function runGuard(url: string) {
  const route = {} as ActivatedRouteSnapshot;
  const state = { url } as RouterStateSnapshot;
  return TestBed.runInInjectionContext(() => authGuard(route, state));
}

function setup(authenticated: boolean) {
  const session = new FakeSession();
  session.authenticated = authenticated;
  TestBed.configureTestingModule({
    providers: [{ provide: SessionStore, useValue: session }],
  });
  return { session, router: TestBed.inject(Router) };
}

describe('safeReturnUrl', () => {
  it('keeps a plain internal path', () => {
    expect(safeReturnUrl('/transfers')).toBe('/transfers');
  });

  it('keeps an internal path with query and hash', () => {
    expect(safeReturnUrl('/transfers?x=1#a')).toBe('/transfers?x=1#a');
  });

  it('ignores protocol-relative URLs', () => {
    expect(safeReturnUrl('//evil.com')).toBeNull();
  });

  it('ignores backslash tricks the browser normalizes to protocol-relative', () => {
    expect(safeReturnUrl('/\\evil.com')).toBeNull();
    expect(safeReturnUrl('/\t/evil.com')).toBeNull();
  });

  it('ignores absolute URLs and dangerous schemes', () => {
    expect(safeReturnUrl('https://evil.com')).toBeNull();
    expect(safeReturnUrl('javascript:alert(1)')).toBeNull();
  });

  it('ignores empty and nullish values', () => {
    expect(safeReturnUrl('')).toBeNull();
    expect(safeReturnUrl(null)).toBeNull();
    expect(safeReturnUrl(undefined)).toBeNull();
  });
});

describe('authGuard', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('waits for rehydration and lets an authenticated user through', async () => {
    const { session } = setup(true);
    const result = await runGuard('/accounts');
    expect(result).toBe(true);
    expect(session.initCalls).toBe(1);
  });

  it('redirects to /login with returnUrl when not authenticated', async () => {
    const { router } = setup(false);
    const result = await runGuard('/transfers');
    const expected = router.createUrlTree(['/login'], { queryParams: { returnUrl: '/transfers' } });
    expect(result!.toString()).toBe(expected.toString());
  });

  it('redirects to /login without returnUrl for an external target', async () => {
    const { router } = setup(false);
    const result = await runGuard('//evil.com');
    const expected = router.createUrlTree(['/login']);
    expect(result!.toString()).toBe(expected.toString());
  });
});
