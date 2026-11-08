import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  viewChild,
  ElementRef,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { type Account } from '../../../shared/domain/account';
import { type Currency } from '../../../shared/domain/currency';
import { type Money } from '../../../shared/domain/money';
import { parseAmountInput, type AmountError } from '../../../shared/domain/parse-amount';
import { formatMoney } from '../../../shared/domain/format-money';
import { amountErrorMessage } from '../../../shared/ui/error-messages';
import {
  type DestinationOption,
} from '../domain/transfer-destinations';
import {
  transferBlockMessage,
  transferCreateErrorMessage,
  destinationIneligibleReason,
} from './transfer-messages';
import { type ApiError } from '../../../shared/domain/map-api-error';

/** Account option for the origin selector. */
export interface TransferAccountOption {
  id: string;
  name: string;
  currency: Currency;
}

/** Payload emitted on submit. The amount is parsed Money (currency = origin). */
export interface TransferFormSubmit {
  originId: string;
  destinationId: string;
  amount: Money;
  description?: string;
}

/**
 * Validator for the amount control: delegates to parseAmountInput (the single
 * source of truth) and surfaces the rejection reason as an Angular error, so
 * <mat-error> shows it when the control is touched or the form was submitted.
 */
function amountValidator(currency: Currency) {
  return (control: AbstractControl): ValidationErrors | null => {
    const result = parseAmountInput(control.value ?? '', currency);
    return result.ok ? null : { amount: result.reason };
  };
}

/**
 * Presentational transfer form. It owns a FormGroup but no business logic: the
 * container (the page) feeds it accounts, the available balance and the
 * destination options (decided in the domain), and listens to its outputs. The
 * form is never destroyed by the page; it is disabled while the transfer is in
 * flight or terminal, so "Intentar de nuevo" keeps the typed values.
 */
@Component({
  selector: 'app-transfer-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './transfer-form.component.html',
  styleUrl: './transfer-form.component.scss',
})
export class TransferFormComponent {
  private readonly fb = inject(FormBuilder);

  // --- inputs from the page ---------------------------------------------
  readonly accounts = input.required<TransferAccountOption[]>();
  /** Available balance of the chosen origin, or null when it could not be computed. */
  readonly available = input<Money | null>(null);
  /** True when the available balance is unknown (show the reason + retry). */
  readonly availableUnknown = input(false);
  /** Destination options (eligibility decided in the domain). */
  readonly destinations = input.required<DestinationOption[]>();
  /** Disable the whole form (while submitting/tracking/terminal). */
  readonly formDisabled = input(false);
  /** Busy = validating or submitting: the submit button shows a spinner. */
  readonly busy = input(false);
  /** True when a transfer is in flight from the chosen origin (block new sends). */
  readonly inFlightFromOrigin = input(false);
  /** A known create error to show inline (role=alert); null when none. */
  readonly lastError = input<ApiError | null>(null);

  // --- outputs to the page ----------------------------------------------
  readonly transferSubmit = output<TransferFormSubmit>();
  readonly originChange = output<string>();
  readonly retryAvailable = output<void>();
  /** Emitted on any field edit, so the page clears a stale block / lastError. */
  readonly formEdited = output<void>();

  private readonly amountField = viewChild<ElementRef<HTMLElement>>('amountField');

  readonly form = this.fb.nonNullable.group({
    origin: ['', [Validators.required]],
    destination: ['', [Validators.required]],
    amount: ['', [Validators.required]],
    description: ['', [Validators.maxLength(500)]],
  });

  private readonly originValue = toSignal(this.form.controls.origin.valueChanges, {
    initialValue: this.form.controls.origin.value,
  });
  private readonly amountValue = toSignal(this.form.controls.amount.valueChanges, {
    initialValue: this.form.controls.amount.value,
  });

  /** The chosen origin account, or null. */
  readonly originAccount = computed<TransferAccountOption | null>(() => {
    const id = this.originValue();
    return this.accounts().find((a) => a.id === id) ?? null;
  });

  readonly originCurrency = computed<Currency | null>(() => this.originAccount()?.currency ?? null);

  readonly availableText = computed<string | null>(() => {
    if (this.availableUnknown()) return null;
    const money = this.available();
    return money === null ? null : `Disponible: ${formatMoney(money)}`;
  });

  readonly availableUnknownText = computed(() => transferBlockMessage('available-unknown'));

  /** Destination options with a per-option label (name + currency + reason). */
  readonly destinationOptions = computed(() =>
    this.destinations().map((o) => ({
      id: o.account.id,
      name: o.account.name,
      currency: o.account.currency,
      eligible: o.eligible,
      reasonText: o.reason ? destinationIneligibleReason(o.reason) : null,
    })),
  );

  readonly hasOrigin = computed(() => this.originAccount() !== null);
  readonly hasEligibleDestination = computed(() =>
    this.destinationOptions().some((o) => o.eligible),
  );

  /** The hint under the destination: ineligible accounts and their reason. */
  readonly ineligibleHint = computed<string | null>(() => {
    if (!this.hasOrigin()) return 'Elegí primero la cuenta de origen';
    const blocked = this.destinationOptions().filter((o) => !o.eligible && o.reasonText);
    if (blocked.length === 0) return null;
    const list = blocked.map((o) => `${o.name} (${o.reasonText!.toLowerCase()})`).join(', ');
    return `No disponibles: ${list}`;
  });

  readonly noDestinationMessage = computed<string | null>(() => {
    if (!this.hasOrigin() || this.hasEligibleDestination()) return null;
    const cur = this.originCurrency();
    return `No tenés otra cuenta en ${cur} a la que transferir.`;
  });

  /** Parsed Money while the amount is valid, in the origin currency; else null. */
  readonly parsedMoney = computed<Money | null>(() => {
    const cur = this.originCurrency();
    if (cur === null) return null;
    const result = parseAmountInput(this.amountValue(), cur);
    return result.ok ? result.money : null;
  });

  readonly preview = computed<string | null>(() => {
    const money = this.parsedMoney();
    const origin = this.originAccount();
    const destId = this.form.controls.destination.value;
    const dest = this.destinationOptions().find((o) => o.id === destId);
    if (money === null || origin === null || !dest) return null;
    return `Vas a transferir ${formatMoney(money)} de ${origin.name} a ${dest.name}`;
  });

  readonly inFlightText = computed(() => transferBlockMessage('in-flight-from-account'));

  readonly lastErrorText = computed<string | null>(() => {
    const err = this.lastError();
    return err === null ? null : transferCreateErrorMessage(err);
  });

  constructor() {
    // Keep the amount validator in sync with the origin currency: re-parsing
    // with the right scale, like the new-transaction dialog but reactive.
    effect(() => {
      const cur = this.originCurrency();
      const control = this.form.controls.amount;
      const validators = cur
        ? [Validators.required, amountValidator(cur)]
        : [Validators.required];
      control.setValidators(validators);
      control.updateValueAndValidity({ emitEvent: false });
    });

    // Enable/disable the whole form without emitting value events (so the
    // disable itself does not trigger formEdited or re-validation storms).
    effect(() => {
      const disabled = this.formDisabled();
      if (disabled && this.form.enabled) {
        this.form.disable({ emitEvent: false });
      } else if (!disabled && this.form.disabled) {
        this.form.enable({ emitEvent: false });
      }
    });

    // When the origin changes: tell the page, and drop a destination that is no
    // longer eligible so a stale cross-currency/same-account value never submits.
    effect(() => {
      const originId = this.originValue();
      // Depend on the origin only; read the rest untracked-ish via current value.
      const destId = this.form.controls.destination.value;
      if (originId) {
        this.originChange.emit(originId);
      }
      if (destId) {
        const stillValid = this.destinationOptions().some((o) => o.id === destId && o.eligible);
        if (!stillValid) {
          this.form.controls.destination.setValue('', { emitEvent: false });
        }
      }
    });
  }

  /** Catalogue message for the amount control's current error (empty if none). */
  amountErrorText(): string {
    const errors = this.form.controls.amount.errors;
    if (!errors) return '';
    if (errors['required']) return amountErrorMessage('empty');
    if (errors['amount']) return amountErrorMessage(errors['amount'] as AmountError);
    return '';
  }

  /** Called from the page to set the preselected origin from ?from=. */
  setOrigin(id: string): void {
    this.form.controls.origin.setValue(id);
  }

  /** Clears amount and description, keeps origin and destination, focuses amount. */
  resetForNext(): void {
    this.form.controls.amount.reset('');
    this.form.controls.description.reset('');
    this.focusAmount();
  }

  onEdit(): void {
    // Any edit clears a stale block / lastError message in the page.
    this.formEdited.emit();
  }

  submit(): void {
    if (this.busy() || this.inFlightFromOrigin()) return; // guard; page also guards
    this.form.markAllAsTouched();
    const money = this.parsedMoney();
    const origin = this.originAccount();
    const destId = this.form.controls.destination.value;
    if (this.form.invalid || money === null || origin === null || destId === '') {
      this.focusAmount();
      return;
    }
    const description = this.form.controls.description.value.trim();
    this.transferSubmit.emit({
      originId: origin.id,
      destinationId: destId,
      amount: money,
      ...(description !== '' ? { description } : {}),
    });
  }

  private focusAmount(): void {
    this.amountField()?.nativeElement?.querySelector<HTMLElement>('input')?.focus();
  }
}
