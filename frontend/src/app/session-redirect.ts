import { Injectable, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SessionStore } from './features/auth/application/session.store';
import { safeReturnUrl } from './features/auth/infrastructure/auth.guard';

/**
 * Navigates to /login when a session ENDS, i.e. on the transition
 * authenticated -> anonymous. Reacting to the transition (not to every
 * anonymous state) matters: the initial state is also anonymous while the app
 * rehydrates, so reacting to plain anonymous would bounce a valid reload to login.
 *
 * - On expiry: /login?returnUrl=<current full url>.
 * - On voluntary logout: /login (no returnUrl).
 * - Never redirects if already on /login (no loop).
 *
 * Lives in app/ (not core/) so core imports nothing from features.
 */
@Injectable({ providedIn: 'root' })
export class SessionRedirect {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  private wasAuthenticated = false;

  constructor() {
    effect(() => {
      const status = this.session.session().status;
      const wasAuth = this.wasAuthenticated;
      this.wasAuthenticated = status === 'authenticated';

      // Only act on the authenticated -> anonymous transition.
      if (!wasAuth || status !== 'anonymous') {
        return;
      }
      this.redirectToLogin();
    });
  }

  private redirectToLogin(): void {
    const url = this.router.url;
    if (url.startsWith('/login')) {
      return; // already there: no loop
    }
    const reason = this.session.endReason();
    if (reason === 'logout') {
      this.router.navigate(['/login']);
      return;
    }
    // Expiry: keep the full current URL (path + query) as returnUrl, if internal.
    const returnUrl = safeReturnUrl(url);
    this.router.navigate(['/login'], returnUrl ? { queryParams: { returnUrl } } : {});
  }

  /** No-op accessor so the service can be eagerly instantiated at bootstrap. */
  init(): void {
    /* effect is wired in the constructor */
  }
}
