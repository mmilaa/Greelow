import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthPort, type AuthUser } from './auth.port';
import { TokenStoragePort } from './token-storage.port';
import { ApiErrorException } from '../../../shared/domain/map-api-error';

/**
 * Session state machine. `loading` covers both login and rehydration.
 *
 * Uses signals and inject (allowed in application), but no browser, HTTP or
 * Router: persistence goes through TokenStoragePort and navigation is the UI's job.
 */
export type SessionState =
  | { status: 'anonymous' }
  | { status: 'loading' }
  | { status: 'authenticated'; user: AuthUser };

/** Why the session ended, read by the redirect effect to choose the target. */
export type SessionEndReason = 'expired' | 'logout';

@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly auth = inject(AuthPort);
  private readonly tokens = inject(TokenStoragePort);

  private readonly state = signal<SessionState>({ status: 'anonymous' });
  private readonly endReasonState = signal<SessionEndReason | null>(null);

  /** One-shot rehydration cache: the in-flight /auth/me promise, if any. */
  private rehydration: Promise<SessionState> | null = null;
  /** Whether a successful (cacheable) rehydration already completed. */
  private initialized = false;

  readonly session = this.state.asReadonly();
  /** Reason the session last ended ('expired' | 'logout'), or null if never ended. */
  readonly endReason = this.endReasonState.asReadonly();
  readonly user = computed(() => {
    const s = this.state();
    return s.status === 'authenticated' ? s.user : null;
  });
  readonly isAuthenticated = computed(() => this.state().status === 'authenticated');
  readonly isLoading = computed(() => this.state().status === 'loading');

  /** Logs in, persists the token, and marks the session authenticated. */
  async login(email: string, password: string): Promise<AuthUser> {
    this.state.set({ status: 'loading' });
    try {
      const { token, user } = await this.auth.login(email, password);
      this.tokens.set(token);
      this.endReasonState.set(null);
      this.state.set({ status: 'authenticated', user });
      this.initialized = true;
      return user;
    } catch (err) {
      // Login failure (e.g. invalid-credentials) never clears a session.
      this.state.set({ status: 'anonymous' });
      throw err;
    }
  }

  /**
   * Clears the session. Idempotent: concurrent 401s expire it only once.
   * `reason` records whether this was a token expiry (default) or a voluntary
   * logout, so the redirect effect can choose the target.
   */
  expire(reason: SessionEndReason = 'expired'): void {
    this.tokens.clear();
    this.rehydration = null;
    this.initialized = false;
    this.endReasonState.set(reason);
    if (this.state().status !== 'anonymous') {
      this.state.set({ status: 'anonymous' });
    }
  }

  /** Explicit logout: same cleanup as expire, flagged as a voluntary logout. */
  logout(): void {
    this.expire('logout');
  }

  /**
   * Validates the stored token once via /auth/me and caches the result on
   * success. If there is no token, stays anonymous without calling the API.
   * A non-unauthenticated failure (network, 5xx, invalid response) does NOT
   * clear the token and is NOT cached, so a later attempt can retry.
   */
  ensureInitialized(): Promise<SessionState> {
    if (this.initialized) {
      return Promise.resolve(this.state());
    }
    if (this.rehydration) {
      return this.rehydration;
    }
    this.rehydration = this.rehydrate();
    return this.rehydration;
  }

  private async rehydrate(): Promise<SessionState> {
    const token = this.tokens.get();
    if (!token) {
      this.state.set({ status: 'anonymous' });
      return this.state();
    }

    this.state.set({ status: 'loading' });
    try {
      const user = await this.auth.me();
      this.state.set({ status: 'authenticated', user });
      this.initialized = true;
      return this.state();
    } catch (err) {
      if (err instanceof ApiErrorException && err.error.kind === 'unauthenticated') {
        // Token is no longer valid: clear it.
        this.tokens.clear();
        this.state.set({ status: 'anonymous' });
        this.initialized = true;
      } else {
        // Transient failure: keep the token, do not cache, allow a retry.
        this.state.set({ status: 'anonymous' });
        this.rehydration = null;
      }
      return this.state();
    }
  }
}
