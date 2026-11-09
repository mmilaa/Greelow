import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { type ThemePreference, applyTheme, readStoredPreference, storePreference } from './theme';

function getStorage(win: Window | null): Storage | null {
  try {
    return win?.localStorage ?? null; // acceder a localStorage también puede lanzar
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  private readonly storage = getStorage(this.doc.defaultView);
  private readonly state = signal<ThemePreference>(readStoredPreference(this.storage));

  readonly preference = this.state.asReadonly();

  constructor() {
    applyTheme(this.doc.documentElement, this.state());
  }

  set(preference: ThemePreference): void {
    this.state.set(preference);
    storePreference(this.storage, preference);
    applyTheme(this.doc.documentElement, preference);
  }
}