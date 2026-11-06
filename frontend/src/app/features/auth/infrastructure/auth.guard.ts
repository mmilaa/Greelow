import { inject } from '@angular/core';
import { Router, type CanActivateFn, type UrlTree } from '@angular/router';
import { SessionStore } from '../application/session.store';

/** A synthetic origin used only to resolve and validate candidate return URLs. */
const INTERNAL_BASE = 'https://internal.invalid';

/**
 * Keeps a return URL only if it is genuinely internal. A string check is not
 * enough: browsers normalize "\" and control characters, so "/\evil.com" or
 * "/\t/evil.com" resolve to a protocol-relative "//evil.com" (a different
 * origin). We resolve the candidate against a synthetic base and accept it only
 * if the resolved origin is still that base; otherwise it is ignored.
 */
export function safeReturnUrl(url: unknown): string | null {
  if (typeof url !== 'string' || url.length === 0 || !url.startsWith('/')) {
    return null;
  }
  let resolved: URL;
  try {
    resolved = new URL(url, INTERNAL_BASE);
  } catch {
    return null;
  }
  if (resolved.origin !== INTERNAL_BASE) {
    return null;
  }
  // Return the normalized path+query+hash, never an absolute URL.
  return resolved.pathname + resolved.search + resolved.hash;
}

/**
 * Protects routes. Waits for session rehydration (GET /auth/me) to finish
 * before deciding, so there is no flash of login on reload. If authenticated,
 * lets through; otherwise redirects to /login, remembering the target as
 * returnUrl when it is an internal path.
 */
export const authGuard: CanActivateFn = async (_route, state): Promise<boolean | UrlTree> => {
  const session = inject(SessionStore);
  const router = inject(Router);

  await session.ensureInitialized();

  if (session.isAuthenticated()) {
    return true;
  }

  const returnUrl = safeReturnUrl(state.url);
  return router.createUrlTree(
    ['/login'],
    returnUrl ? { queryParams: { returnUrl } } : {},
  );
};

/**
 * Guards the /login route: if a (rehydrated) session is already active, there
 * is no reason to show the login form, so redirect to /accounts.
 */
export const loginGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const session = inject(SessionStore);
  const router = inject(Router);

  await session.ensureInitialized();

  return session.isAuthenticated() ? router.createUrlTree(['/accounts']) : true;
};
