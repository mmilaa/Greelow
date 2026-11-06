import { Injectable } from '@angular/core';
import { TokenStoragePort } from '../application/token-storage.port';

const TOKEN_KEY = 'auth_token';

/**
 * Token storage backed by sessionStorage, with an in-memory fallback used when
 * sessionStorage is unavailable or throws (private mode, blocked storage, SSR).
 */
@Injectable()
export class SessionTokenStorage extends TokenStoragePort {
  private memory: string | null = null;

  override get(): string | null {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return this.memory;
    }
  }

  override set(token: string): void {
    this.memory = token;
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Keep the in-memory copy only.
    }
  }

  override clear(): void {
    this.memory = null;
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // Nothing else to do; memory already cleared.
    }
  }
}
