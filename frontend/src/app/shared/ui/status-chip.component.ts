import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { type TransactionStatus } from '../domain/transaction';

interface StatusView {
  label: string;
  icon: string;
  modifier: 'pending' | 'completed' | 'failed';
}

const STATUS_VIEW: Record<TransactionStatus, StatusView> = {
  pending: { label: 'Procesando', icon: 'hourglass_empty', modifier: 'pending' },
  completed: { label: 'Completada', icon: 'check_circle', modifier: 'completed' },
  failed: { label: 'Fallida', icon: 'error', modifier: 'failed' },
};

/**
 * Status chip for a transaction: icon + text + semantic colour. The text is
 * always present (colour is never the only signal). Presentational only.
 */
@Component({
  selector: 'app-status-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <span class="chip" [class]="'chip--' + view().modifier">
      <mat-icon class="chip__icon" aria-hidden="true">{{ view().icon }}</mat-icon>
      <span class="chip__label">{{ view().label }}</span>
    </span>
  `,
  styleUrl: './status-chip.component.scss',
})
export class StatusChipComponent {
  readonly status = input.required<TransactionStatus>();
  readonly view = computed(() => STATUS_VIEW[this.status()]);
}
