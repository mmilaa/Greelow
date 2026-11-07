import { Injectable, computed, inject, signal } from '@angular/core';
import { CategoryPort } from './category.port';

/** State of the fixed category list used to populate the category filter. */
export type CategoryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; categories: string[] }
  | { status: 'error' };

/**
 * Loads the fixed category list once and caches it. If it fails, the rest of
 * the transactions screen keeps working: the category filter is disabled with a
 * notice, but any `category` already in the URL is still sent to the API.
 *
 * Signals + inject (allowed in application); no browser, HTTP or Router.
 */
@Injectable({ providedIn: 'root' })
export class CategoryStore {
  private readonly port = inject(CategoryPort);

  private readonly stateSig = signal<CategoryState>({ status: 'idle' });
  private inFlight: Promise<void> | null = null;

  readonly state = this.stateSig.asReadonly();

  /** The loaded list, or null while idle/loading/errored (null = "not known yet"). */
  readonly categories = computed<string[] | null>(() => {
    const s = this.stateSig();
    return s.status === 'ready' ? s.categories : null;
  });

  readonly failed = computed(() => this.stateSig().status === 'error');

  /**
   * Loads the list once. Idempotent: concurrent calls share one request; once
   * ready it is a no-op; after an error it retries on the next call.
   */
  loadOnce(): Promise<void> {
    if (this.inFlight) {
      return this.inFlight;
    }
    if (this.stateSig().status === 'ready') {
      return Promise.resolve();
    }
    const p = this.run().finally(() => {
      if (this.inFlight === p) {
        this.inFlight = null;
      }
    });
    this.inFlight = p;
    return p;
  }

  private async run(): Promise<void> {
    this.stateSig.set({ status: 'loading' });
    try {
      const categories = await this.port.list();
      this.stateSig.set({ status: 'ready', categories });
    } catch {
      this.stateSig.set({ status: 'error' });
    }
  }
}
