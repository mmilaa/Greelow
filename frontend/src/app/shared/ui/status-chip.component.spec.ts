import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { StatusChipComponent } from './status-chip.component';
import { type TransactionStatus } from '../domain/transaction';

function render(status: TransactionStatus) {
  const fixture = TestBed.createComponent(StatusChipComponent);
  fixture.componentRef.setInput('status', status);
  fixture.detectChanges();
  return fixture;
}

describe('StatusChipComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows Spanish text for each status (not only colour)', () => {
    expect((render('pending').nativeElement as HTMLElement).textContent).toContain('Procesando');
    expect((render('completed').nativeElement as HTMLElement).textContent).toContain('Completada');
    expect((render('failed').nativeElement as HTMLElement).textContent).toContain('Fallida');
  });

  it('exposes an icon per status', () => {
    expect(render('pending').componentInstance.view().icon).toBe('hourglass_empty');
    expect(render('completed').componentInstance.view().icon).toBe('check_circle');
    expect(render('failed').componentInstance.view().icon).toBe('error');
  });
});
