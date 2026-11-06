import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionTokenStorage } from './session-token-storage.adapter';

describe('SessionTokenStorage', () => {
  beforeEach(() => {
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });

  afterEach(() => vi.restoreAllMocks());

  it('persists, reads and clears via sessionStorage', () => {
    const store = new SessionTokenStorage();
    expect(store.get()).toBeNull();
    store.set('tok-1');
    expect(store.get()).toBe('tok-1');
    store.clear();
    expect(store.get()).toBeNull();
  });

  it('falls back to memory when sessionStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    const store = new SessionTokenStorage();
    store.set('tok-mem');
    // getItem throws -> returns the in-memory copy.
    expect(store.get()).toBe('tok-mem');
    store.clear();
    expect(store.get()).toBeNull();
  });
});
