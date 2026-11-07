import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MoneyAmountComponent } from '../../../shared/ui/money-amount.component';
import { type AccountRow } from '../application/accounts.store';

/**
 * A single account card. Presentational only: receives an AccountRow and shows
 * name, currency code, account id, ledger balance, and (only when there are
 * outgoing pending transfers) the available balance with an "in process" notice.
 *
 * The whole card is clickable via the stretched-link pattern: the link wraps
 * only the name (inside an h2) and an ::after overlay makes the card clickable,
 * so the link's accessible name stays short.
 */
@Component({
  selector: 'app-account-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, MoneyAmountComponent],
  templateUrl: './account-card.component.html',
  styleUrl: './account-card.component.scss',
})
export class AccountCardComponent {
  readonly row = input.required<AccountRow>();
}
