import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { LoginPage } from './login.page';
import { SessionStore } from '../application/session.store';
import { ApiErrorException } from '../../../shared/domain/map-api-error';

class FakeSession {
  login = vi.fn();
}

function setup(returnUrl: string | null = null) {
  const session = new FakeSession();
  const navigateByUrl = vi.fn().mockResolvedValue(true);
  const route = {
    snapshot: { queryParamMap: { get: (k: string) => (k === 'returnUrl' ? returnUrl : null) } },
  };

  TestBed.configureTestingModule({
    providers: [
      { provide: SessionStore, useValue: session },
      { provide: ActivatedRoute, useValue: route },
      { provide: Router, useValue: { navigateByUrl } },
    ],
  });
  const fixture = TestBed.createComponent(LoginPage);
  const page = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, page, session, navigateByUrl };
}

describe('LoginPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('does not call the store when the form is invalid (case A)', async () => {
    const { page, session } = setup();
    await page.submit(); // empty form
    expect(session.login).not.toHaveBeenCalled();
    expect(page.form.controls.email.touched).toBe(true);
  });

  it('logs in and navigates to the returnUrl when valid', async () => {
    const { page, session, navigateByUrl } = setup('/transfers');
    session.login.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'A' });
    page.form.setValue({ email: 'demo@example.com', password: 'demo123' });
    await page.submit();
    expect(session.login).toHaveBeenCalledWith('demo@example.com', 'demo123');
    expect(navigateByUrl).toHaveBeenCalledWith('/transfers');
  });

  it('navigates to /accounts by default and ignores an external returnUrl (case C)', async () => {
    const { page, session, navigateByUrl } = setup('//evil.com');
    session.login.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'A' });
    page.form.setValue({ email: 'demo@example.com', password: 'demo123' });
    await page.submit();
    expect(navigateByUrl).toHaveBeenCalledWith('/accounts');
  });

  it('shows the catalogue message for invalid credentials, not the raw API text (case D)', async () => {
    const { page, session } = setup();
    session.login.mockRejectedValue(new ApiErrorException({ kind: 'invalid-credentials' }));
    page.form.setValue({ email: 'demo@example.com', password: 'wrong' });
    await page.submit();
    expect(page.serverError()).toBe('El email o la contraseña son incorrectos.');
    expect(page.serverError()).not.toContain('Invalid');
  });

  it('shows the network message for a network error (case B)', async () => {
    const { page, session } = setup();
    session.login.mockRejectedValue(new ApiErrorException({ kind: 'network' }));
    page.form.setValue({ email: 'demo@example.com', password: 'demo123' });
    await page.submit();
    expect(page.serverError()).toBe('No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.');
  });

  it('shows a generic message and re-enables the button for a non-API error', async () => {
    const { page, session } = setup();
    session.login.mockRejectedValue(new Error('boom'));
    page.form.setValue({ email: 'demo@example.com', password: 'demo123' });
    await page.submit();
    expect(page.serverError()).toBe('Ocurrió un error inesperado. Intentá de nuevo.');
    expect(page.submitting()).toBe(false);
  });

  it('does not submit twice while in flight (case E)', async () => {
    const { page, session } = setup();
    let resolve!: (v: unknown) => void;
    session.login.mockReturnValue(new Promise((r) => (resolve = r)));
    page.form.setValue({ email: 'demo@example.com', password: 'demo123' });

    const first = page.submit();
    await page.submit(); // second call while submitting
    expect(session.login).toHaveBeenCalledTimes(1);

    resolve({ id: 'u1', email: 'a@b.c', name: 'A' });
    await first;
  });

  it('resets submitting to false after completion', async () => {
    const { page, session } = setup();
    session.login.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'A' });
    page.form.setValue({ email: 'demo@example.com', password: 'demo123' });
    await page.submit();
    expect(page.submitting()).toBe(false);
  });
});
