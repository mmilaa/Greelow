import { InjectionToken } from '@angular/core';

/**
 * Callback invoked when a request is classified as `unauthenticated` (a 401
 * outside login). Defined in core so core depends on no feature; the auth
 * feature provides an implementation (session.expire()) and the app root wires
 * them together.
 *
 * Defaults to a no-op so core works even if nothing provides it.
 */
export const ON_UNAUTHENTICATED = new InjectionToken<() => void>('ON_UNAUTHENTICATED', {
  providedIn: 'root',
  factory: () => () => {},
});
