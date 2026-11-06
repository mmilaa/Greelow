import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SessionRedirect } from './session-redirect';
import {
  SessionStore,
  type SessionState,
  type SessionEndReason,
} from './features/auth/application/session.store';

/** Fake session store exposing writable signals the effect reads. */
class FakeSession {
  readonly sessionSig = signal<SessionState>({ status: 'anonymous' });
  readonly endReasonSig = signal<SessionEndReason | null>(null);
  session = this.sessionSig.asReadonly();
  endReason = this.endReasonSig.asReadonly();
}

function setup(currentUrl: string) {
  const session = new FakeSession();
  const navigate = vi.fn();
  const router = { url: currentUrl, navigate } as unknown as Router;

  TestBed.configureTestingModule({
    providers: [
      SessionRedirect,
      { provide: SessionStore, useValue: session },
      { provide: Router, useValue: router },
    ],
  });
  // Instantiate the service so its effect runs.
  TestBed.inject(SessionRedirect);
  return { session, navigate, router };
}

/** Flushes signal effects. */
function flush() {
  TestBed.flushEffects?.() ?? TestBed.tick?.();
}

describe('SessionRedirect', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('does not redirect on the initial anonymous state (e.g. reload while rehydrating)', () => {
    const { navigate } = setup('/accounts');
    flush();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not redirect when staying authenticated (valid reload stays put)', () => {
    const { session, navigate } = setup('/accounts');
    session.sessionSig.set({ status: 'loading' });
    flush();
    session.sessionSig.set({ status: 'authenticated', user: { id: 'u1', email: 'a@b.c', name: 'A' } });
    flush();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('on expiry redirects to /login with the current full url as returnUrl', () => {
    const { session, navigate } = setup('/transfers?x=1');
    session.sessionSig.set({ status: 'authenticated', user: { id: 'u1', email: 'a@b.c', name: 'A' } });
    flush();
    session.endReasonSig.set('expired');
    session.sessionSig.set({ status: 'anonymous' });
    flush();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/transfers?x=1' } });
  });

  it('on voluntary logout redirects to /login without returnUrl', () => {
    const { session, navigate } = setup('/accounts');
    session.sessionSig.set({ status: 'authenticated', user: { id: 'u1', email: 'a@b.c', name: 'A' } });
    flush();
    session.endReasonSig.set('logout');
    session.sessionSig.set({ status: 'anonymous' });
    flush();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('does not redirect if already on /login (no loop)', () => {
    const { session, navigate } = setup('/login');
    session.sessionSig.set({ status: 'authenticated', user: { id: 'u1', email: 'a@b.c', name: 'A' } });
    flush();
    session.endReasonSig.set('expired');
    session.sessionSig.set({ status: 'anonymous' });
    flush();
    expect(navigate).not.toHaveBeenCalled();
  });
});
