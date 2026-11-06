import { inject } from '@angular/core';
import { type HttpInterceptorFn } from '@angular/common/http';
import { API_BASE_URL } from '../../../core/config/api.config';
import { TokenStoragePort } from '../application/token-storage.port';

/**
 * True when `url` targets the same origin as `baseUrl`. Compared by origin
 * (scheme + host + port), NOT by string prefix: a prefix check would wrongly
 * match look-alike hosts like "http://localhost:3000.evil.com" and leak the token.
 */
function sameOrigin(url: string, baseUrl: string): boolean {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    // Relative URL (no origin): it stays within the app, not the API host.
    return false;
  }
  return target.origin === new URL(baseUrl).origin;
}

/**
 * Adds `Authorization: Bearer <token>` to requests going to the API origin only,
 * when a token is stored. It does nothing else: classifying the 401 and firing
 * the session-expiry effect happens in runRequest via ON_UNAUTHENTICATED.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const baseUrl = inject(API_BASE_URL);
  const tokens = inject(TokenStoragePort);
  const token = tokens.get();

  if (token && sameOrigin(req.url, baseUrl)) {
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  }
  return next(req);
};
