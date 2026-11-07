import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { type Transaction } from '../../../shared/domain/transaction';
import { signedAmount } from '../../../shared/domain/signed-amount';
import { formatDateTime } from '../../../shared/domain/format-date';
import {
  transactionTypeLabel,
  categoryLabel,
} from '../../../shared/ui/transaction-labels';
import { MoneyAmountComponent } from '../../../shared/ui/money-amount.component';
import { StatusChipComponent } from '../../../shared/ui/status-chip.component';

/**
 * One row of the "latest movements" list. Presentational only: it formats a
 * Transaction via the shared domain/UI helpers. Pending and failed rows dim the
 * amount with the soft text token (never opacity, which would drop contrast
 * below AA) and always show the status chip.
 */
@Component({
  selector: 'app-movement-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyAmountComponent, StatusChipComponent],
  templateUrl: './movement-row.component.html',
  styleUrl: './movement-row.component.scss',
})
export class MovementRowComponent {
  readonly movement = input.required<Transaction>();

  readonly typeLabel = computed(() =>
    transactionTypeLabel(this.movement().type, this.movement().direction),
  );
  readonly signed = computed(() => signedAmount(this.movement()));
  readonly dateText = computed(() => formatDateTime(this.movement().createdAt));
  /** Transfers never repeat the category ("transfer"); it is shown only for income/expense. */
  readonly categoryText = computed(() =>
    this.movement().type === 'transfer' ? null : categoryLabel(this.movement().category),
  );
  readonly settled = computed(() => this.movement().status === 'completed');
}
