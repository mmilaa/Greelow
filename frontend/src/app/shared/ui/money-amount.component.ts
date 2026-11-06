import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { type Money } from '../domain/money';
import { formatMoney } from '../domain/format-money';

/**
 * Displays a Money value. The negative sign is part of the formatted string
 * (so it reads correctly without colour), and negatives also get a distinct
 * class — colour is never the only signal.
 *
 * Presentational only: it receives an already-computed Money, no business logic.
 */
@Component({
  selector: 'app-money-amount',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="money" [class.money--negative]="isNegative()">{{ text() }}</span>`,
  styleUrl: './money-amount.component.scss',
})
export class MoneyAmountComponent {
  readonly amount = input.required<Money>();

  readonly text = computed(() => formatMoney(this.amount()));
  readonly isNegative = computed(() => this.amount().isNegative());
}
