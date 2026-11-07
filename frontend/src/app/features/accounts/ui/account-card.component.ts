import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountSummaryComponent } from './account-summary.component';
import { type AccountRow } from '../../../shared/application/accounts.store';

/**
 * A single account card for the list. Shows the name (as a stretched link) and
 * the account id, and delegates the money summary to AccountSummaryComponent.
 *
 * The whole card is clickable via the stretched-link pattern: the link wraps
 * only the name (inside an h2) and an ::after overlay makes the card clickable,
 * so the link's accessible name stays short.
 */
@Component({
  selector: 'app-account-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AccountSummaryComponent],
  templateUrl: './account-card.component.html',
  styleUrl: './account-card.component.scss',
})
export class AccountCardComponent {
  readonly row = input.required<AccountRow>();
}
