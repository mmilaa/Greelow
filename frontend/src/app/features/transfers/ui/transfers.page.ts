import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AccountsStore } from '../../../shared/application/accounts.store';
import { TransferStore } from '../application/transfer.store';
import { TransferTracker } from '../application/transfer-tracker';
import { eligibleDestinations, type DestinationOption } from '../domain/transfer-destinations';
import {
  TransferFormComponent,
  type TransferAccountOption,
  type TransferFormSubmit,
} from './transfer-form.component';
import { TransferStatusPanelComponent } from './transfer-status-panel.component';

/**
 * Transfers page. The only piece that knows the store and the tracker: it
 * provides both at the component level (not root) and cancels timers on destroy
 * via DestroyRef, so leaving the page leaves no timers. It feeds the
 * presentational form and status panel and delegates actions to the store; no
 * business logic lives here (funds -> canTransfer in the store, eligibility ->
 * the domain function).
 */
@Component({
  selector: 'app-transfers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TransferStore, TransferTracker],
  imports: [TransferFormComponent, TransferStatusPanelComponent],
  templateUrl: './transfers.page.html',
  styleUrl: './transfers.page.scss',
})
export class TransfersPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly accountsStore = inject(AccountsStore);
  private readonly store = inject(TransferStore);
  private readonly destroyRef = inject(DestroyRef);

  private readonly formComponent = viewChild(TransferFormComponent);

  readonly state = this.store.state;

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  /** The ?from= value as-is (may not be a real account). */
  private readonly fromParam = computed(() => this.queryParams().get('from'));

  /** Account rows from the store; null-ish states give an empty list. */
  private readonly rows = computed(() => {
    const s = this.accountsStore.state();
    return s.status === 'ready' ? s.rows : [];
  });

  /** True while the accounts list is still loading (defer ?from validation). */
  readonly accountsLoading = computed(() => this.accountsStore.state().status === 'loading');

  readonly accountOptions = computed<TransferAccountOption[]>(() =>
    this.rows().map((r) => ({ id: r.account.id, name: r.account.name, currency: r.account.currency })),
  );

  /** The origin id currently chosen in the form (null until the form reports it). */
  private readonly chosenOriginSig = computed(() => this.formComponent()?.originAccount()?.id ?? null);

  /** Available balance of the chosen origin, from the AccountsStore row. */
  readonly available = computed(() => {
    const id = this.chosenOriginSig();
    if (id === null) return null;
    const row = this.rows().find((r) => r.account.id === id);
    return row?.available ?? null;
  });

  readonly availableUnknown = computed(() => {
    const id = this.chosenOriginSig();
    if (id === null) return false;
    const s = this.accountsStore.state();
    if (s.status !== 'ready') return false;
    const row = s.rows.find((r) => r.account.id === id);
    // Unknown when pending could not be read for this row, or the whole read is stale.
    return !s.pendingAvailable || s.stale || row === undefined || row.available === null;
  });

  /** Destination options for the chosen origin (eligibility decided in domain). */
  readonly destinations = computed<DestinationOption[]>(() =>
    eligibleDestinations(this.chosenOriginSig(), this.rows().map((r) => r.account)),
  );

  /** Disable the whole form while submitting, tracking or in a terminal state. */
  readonly formDisabled = computed(() => {
    const s = this.state().status;
    return (
      s === 'submitting' ||
      s === 'tracking' ||
      s === 'confirmed' ||
      s === 'failed' ||
      s === 'unconfirmed' ||
      s === 'uncertain'
    );
  });

  readonly busy = computed(() => {
    const s = this.state().status;
    return s === 'validating' || s === 'submitting';
  });

  /** In-flight transfer from the chosen origin blocks a new send from it. */
  readonly inFlightFromOrigin = computed(() => {
    const id = this.chosenOriginSig();
    return id !== null && !this.store.canSubmitFrom(id);
  });

  /** Known create error to show inline, only while idle. */
  readonly lastError = computed(() => {
    const s = this.state();
    return s.status === 'idle' ? s.lastError : null;
  });

  private preselected = false;

  constructor() {
    // Load the accounts list (idempotent).
    void this.accountsStore.ensureLoaded();

    // Preselect the origin from ?from= once, after the accounts list is ready
    // and the value is a real account. Defer while the list is still loading;
    // an id that never matches is simply ignored (the form shows no origin).
    effect(() => {
      const loading = this.accountsLoading();
      const from = this.fromParam();
      const options = this.accountOptions();
      untracked(() => {
        if (this.preselected || loading || from === null) return;
        if (options.some((o) => o.id === from)) {
          this.formComponent()?.setOrigin(from);
          this.preselected = true;
        }
      });
    });

    // Move focus to the result heading on each terminal state.
    effect(() => {
      const s = this.state().status;
      untracked(() => {
        if (s === 'confirmed' || s === 'failed' || s === 'unconfirmed' || s === 'uncertain') {
          queueMicrotask(() => {
            document.getElementById('transfer-result-heading')?.focus();
          });
        }
      });
    });

    // Cancel timers when leaving the page (no leftover polling).
    this.destroyRef.onDestroy(() => this.store.destroy());
  }

  onSubmit(payload: TransferFormSubmit): void {
    const origin = this.rows().find((r) => r.account.id === payload.originId);
    if (origin === undefined) return; // unreachable: form only offers real accounts
    void this.store.submit({
      fromAccountId: payload.originId,
      destination: { kind: 'own', accountId: payload.destinationId, currency: origin.account.currency },
      amount: payload.amount,
      ...(payload.description !== undefined ? { description: payload.description } : {}),
    });
  }

  /** Any edit clears a stale blocked / lastError message. */
  onFormEdited(): void {
    const s = this.state();
    if (s.status === 'blocked' || (s.status === 'idle' && s.lastError !== null)) {
      this.store.reset();
    }
  }

  onRetryAvailable(): void {
    void this.accountsStore.refresh();
  }

  onVerifyAgain(): void {
    void this.store.verifyAgain();
  }

  onRetryNetwork(): void {
    this.store.retryAfterNetwork();
  }

  onAgain(): void {
    this.store.reset();
    this.formComponent()?.resetForNext();
  }

  onViewAccount(): void {
    const id = this.chosenOriginSig();
    if (id !== null) {
      void this.router.navigate(['/accounts', id]);
    }
  }
}
