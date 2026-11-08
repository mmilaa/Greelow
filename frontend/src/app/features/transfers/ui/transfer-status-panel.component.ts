import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { TransactionRowComponent } from '../../../shared/ui/transaction-row.component';
import { type TransferState } from '../application/transfer.store';
import { type Money } from '../../../shared/domain/money';
import {
  transferBlockMessage,
  transferTrackingMessage,
  transferConfirmedMessage,
  transferFailedMessage,
  transferUnconfirmedMessage,
  transferUncertainMessage,
  verificationFailedNotice,
} from './transfer-messages';

/**
 * Presentational status panel. It maps the TransferStore state to Spanish text
 * from the transfer catalog (never the API text) and emits the user actions. It
 * knows nothing about the store or the API. The container wires the outputs.
 *
 * The result heading (confirmed/failed/unconfirmed/uncertain) carries id
 * "transfer-result-heading" and tabindex -1 so the page can move focus to it.
 */
@Component({
  selector: 'app-transfer-status-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatProgressSpinnerModule, MatIconModule, TransactionRowComponent],
  templateUrl: './transfer-status-panel.component.html',
  styleUrl: './transfer-status-panel.component.scss',
})
export class TransferStatusPanelComponent {
  readonly state = input.required<TransferState>();

  readonly verifyAgain = output<void>();
  readonly retryNetwork = output<void>();
  readonly again = output<void>();
  readonly viewAccount = output<void>();
  readonly retryAvailable = output<void>();

  readonly blockMessage = computed<string | null>(() => {
    const s = this.state();
    if (s.status !== 'blocked') return null;
    const available: Money | null = s.available;
    return transferBlockMessage(s.reason, available);
  });

  readonly isAvailableUnknown = computed(() => {
    const s = this.state();
    return s.status === 'blocked' && s.reason === 'available-unknown';
  });

  readonly trackingText = transferTrackingMessage;
  readonly confirmedText = transferConfirmedMessage;
  readonly failedText = transferFailedMessage;
  readonly unconfirmedText = transferUnconfirmedMessage;

  readonly uncertainText = computed<string | null>(() => {
    const s = this.state();
    return s.status === 'uncertain' ? transferUncertainMessage(s.kind) : null;
  });

  /** True for the network uncertain kind: retry is offered once verification ends. */
  readonly isNetworkUncertain = computed(() => {
    const s = this.state();
    return s.status === 'uncertain' && s.kind === 'network';
  });

  readonly isInvalidResponseUncertain = computed(() => {
    const s = this.state();
    return s.status === 'uncertain' && s.kind === 'invalid-response';
  });

  readonly verifying = computed(() => {
    const s = this.state();
    return s.status === 'uncertain' && s.verifying;
  });

  readonly recentOutgoing = computed(() => {
    const s = this.state();
    return s.status === 'uncertain' ? (s.verification?.recentOutgoing ?? []) : [];
  });

  readonly pendingCount = computed(() => {
    const s = this.state();
    return s.status === 'uncertain' ? (s.verification?.outgoingPending.length ?? 0) : 0;
  });

  readonly verificationFailed = computed(() => {
    const s = this.state();
    return s.status === 'uncertain' && (s.verification?.readFailed ?? false);
  });

  readonly verificationFailedText = verificationFailedNotice;
}
