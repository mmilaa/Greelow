import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ShellComponent } from './shell.component';
import { SessionStore } from '../features/auth/application/session.store';
import { type AuthUser } from '../features/auth/application/auth.port';

class FakeSession {
  readonly userSig = signal<AuthUser | null>({ id: 'u1', email: 'demo@example.com', name: 'Usuario Demo' });
  user = this.userSig.asReadonly();
  logout = vi.fn();
}

function setup() {
  const session = new FakeSession();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: SessionStore, useValue: session },
    ],
  });
  const fixture = TestBed.createComponent(ShellComponent);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, session };
}

describe('ShellComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('exposes the authenticated user name', () => {
    const { component } = setup();
    expect(component.userName()?.name).toBe('Usuario Demo');
  });

  it('logs out through the session store', () => {
    const { component, session } = setup();
    component.logout();
    expect(session.logout).toHaveBeenCalledTimes(1);
  });

  it('lists the three private navigation links', () => {
    const { component } = setup();
    expect(component.links.map((l) => l.path)).toEqual(['/accounts', '/transactions', '/transfers']);
  });
});
