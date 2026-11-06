import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { StatePanelComponent, type PanelState } from './state-panel.component';

function render(state: PanelState) {
  const fixture = TestBed.createComponent(StatePanelComponent);
  fixture.componentRef.setInput('state', state);
  fixture.detectChanges();
  return fixture;
}

describe('StatePanelComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows the loading text when loading', () => {
    const el = render('loading').nativeElement as HTMLElement;
    expect(el.textContent).toContain('Cargando');
  });

  it('shows the empty text when empty', () => {
    const el = render('empty').nativeElement as HTMLElement;
    expect(el.textContent).toContain('No hay nada');
  });

  it('shows the error text and a retry button when in error', () => {
    const el = render('error').nativeElement as HTMLElement;
    expect(el.textContent).toContain('No pudimos cargar');
    expect(el.querySelector('button')).toBeTruthy();
  });

  it('emits retry when the retry button is clicked', () => {
    const fixture = render('error');
    const spy = vi.fn();
    fixture.componentInstance.retry.subscribe(spy);
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    button.click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not show a retry button outside the error state', () => {
    const el = render('loading').nativeElement as HTMLElement;
    expect(el.querySelector('button')).toBeNull();
  });
});
