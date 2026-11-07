import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CategoryStore } from './category.store';
import { CategoryPort } from './category.port';

class FakeCategoryPort extends CategoryPort {
  result: string[] = ['groceries', 'rent'];
  error: unknown = null;
  calls = 0;
  override async list(): Promise<string[]> {
    this.calls += 1;
    if (this.error) throw this.error;
    return this.result;
  }
}

function setup() {
  const port = new FakeCategoryPort();
  TestBed.configureTestingModule({
    providers: [CategoryStore, { provide: CategoryPort, useValue: port }],
  });
  return { store: TestBed.inject(CategoryStore), port };
}

describe('CategoryStore', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('starts idle with categories null', () => {
    const { store } = setup();
    expect(store.state().status).toBe('idle');
    expect(store.categories()).toBeNull();
  });

  it('loads the list once and exposes it', async () => {
    const { store, port } = setup();
    await store.loadOnce();
    expect(store.state().status).toBe('ready');
    expect(store.categories()).toEqual(['groceries', 'rent']);
    expect(store.failed()).toBe(false);
    expect(port.calls).toBe(1);
  });

  it('is idempotent: concurrent calls share one request', async () => {
    const { store, port } = setup();
    await Promise.all([store.loadOnce(), store.loadOnce(), store.loadOnce()]);
    expect(port.calls).toBe(1);
  });

  it('is a no-op once ready', async () => {
    const { store, port } = setup();
    await store.loadOnce();
    await store.loadOnce();
    expect(port.calls).toBe(1);
  });

  it('goes to error on failure, keeping categories null', async () => {
    const { store, port } = setup();
    port.error = new Error('down');
    await store.loadOnce();
    expect(store.state().status).toBe('error');
    expect(store.failed()).toBe(true);
    expect(store.categories()).toBeNull();
  });

  it('retries after an error', async () => {
    const { store, port } = setup();
    port.error = new Error('down');
    await store.loadOnce();
    expect(store.failed()).toBe(true);
    port.error = null;
    await store.loadOnce();
    expect(store.state().status).toBe('ready');
    expect(port.calls).toBe(2);
  });
});
