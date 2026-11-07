import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { type Transaction } from '../domain/transaction';
import { signedAmount } from '../domain/signed-amount';
import { formatDateTime } from '../domain/format-date';
import { transactionTypeLabel, categoryLabel } from './transaction-labels';
import { MoneyAmountComponent } from './money-amount.component';
import { StatusChipComponent } from './status-chip.component';

/**
 * One row of a transactions list. Presentational only: it formats a Transaction
 * via the shared domain/UI helpers. Pending and failed rows dim the amount with
 * the soft text token (never opacity, which would drop contrast below AA) and
 * always show the status chip.
 */
@Component({
  selector: 'app-transaction-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyAmountComponent, StatusChipComponent],
  templateUrl: './transaction-row.component.html',
  styleUrl: './transaction-row.component.scss',
})
export class TransactionRowComponent {
  readonly transaction = input.required<Transaction>();

  readonly typeLabel = computed(() =>
    transactionTypeLabel(this.transaction().type, this.transaction().direction),
  );
  readonly signed = computed(() => signedAmount(this.transaction()));
  readonly dateText = computed(() => formatDateTime(this.transaction().createdAt));
  /** Transfers never repeat the category ("transfer"); it is shown only for income/expense. */
  readonly categoryText = computed(() =>
    this.transaction().type === 'transfer' ? null : categoryLabel(this.transaction().category),
  );
  readonly settled = computed(() => this.transaction().status === 'completed');
}
