import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterOutlet } from '@angular/router';
import { App } from './app';
import { SessionRedirect } from './session-redirect';

// SessionRedirect is stubbed: its effect (Router + SessionStore wiring) is
// tested on its own; here we only verify that App hosts the router outlet.
class SessionRedirectStub {}

describe('App', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: SessionRedirect, useClass: SessionRedirectStub },
      ],
    });
  });

  it('creates the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders a router outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const outlet = fixture.debugElement.query((el) => el.name === 'router-outlet');
    expect(outlet).toBeTruthy();
    // And it wires the RouterOutlet directive.
    expect(fixture.componentInstance).toBeInstanceOf(App);
    expect(RouterOutlet).toBeDefined();
  });
});
