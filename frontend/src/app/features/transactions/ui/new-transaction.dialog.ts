import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
  viewChildren,
  ElementRef,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CategoryStore } from '../application/category.store';
import { CreateTransactionStore } from '../application/create-transaction.store';
import { type Currency } from '../../../shared/domain/currency';
import { type Money } from '../../../shared/domain/money';
import { parseAmountInput, type AmountError } from '../../../shared/domain/parse-amount';
import { formatMoney } from '../../../shared/domain/format-money';
import { categoriesFor } from '../domain/transaction-categories';
import { leavesNegative } from '../domain/leaves-negative';
import { categoryLabel } from '../../../shared/ui/transaction-labels';
import {
  errorMessage,
  amountErrorMessage,
  uncertainResultMessage,
} from '../../../shared/ui/error-messages';
import {
  type NewTransactionRequest,
  type NewTransactionResult,
} from '../../../shared/ui/new-transaction-launcher';

/**
 * Validator for the amount control: delegates to parseAmountInput (the single
 * source of truth for amount parsing) and surfaces its rejection reason as a
 * standard Angular error, so <mat-error> shows it when the control is invalid
 * and touched (or the form was submitted).
 */
function amountValidator(currency: Currency) {
  return (control: AbstractControl): ValidationErrors | null => {
    const result = parseAmountInput(control.value ?? '', currency);
    return result.ok ? null : { amount: result.reason };
  };
}

@Component({
  selector: 'app-new-transaction-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CreateTransactionStore],
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './new-transaction.dialog.html',
  styleUrl: './new-transaction.dialog.scss',
})
export class NewTransactionDialog {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly categoryStore = inject(CategoryStore);
  private readonly store = inject(CreateTransactionStore);
  private readonly dialogRef =
    inject<MatDialogRef<NewTransactionDialog, NewTransactionResult>>(MatDialogRef);
  readonly data = inject<NewTransactionRequest>(MAT_DIALOG_DATA);

  private readonly fields = viewChildren<ElementRef<HTMLElement>>('field');

  readonly categoryLabelOf = categoryLabel;
  readonly submitting = this.store.submitting;

  readonly account = this.data.row.account;
  readonly type = this.data.type;
  readonly titleText = this.type === 'income' ? 'Registrar ingreso' : 'Registrar gasto';

  readonly form = this.fb.nonNullable.group({
    amount: ['', [Validators.required, amountValidator(this.account.currency)]],
    category: [''],
    description: ['', [Validators.maxLength(500)]],
  });

  private readonly amountValue = toSignalValue(this.form.controls.amount);

  readonly categoryOptions = computed<string[]>(() => {
    const catalog = this.categoryStore.categories();
    if (catalog === null) return [];
    return categoriesFor(this.type, catalog, categoryLabel);
  });
  readonly categoriesDisabled = computed(() => this.categoryStore.failed());

  /** The parsed Money while the amount is valid, or null. Drives the preview. */
  readonly parsedMoney = computed<Money | null>(() => {
    const result = parseAmountInput(this.amountValue(), this.account.currency);
    return result.ok ? result.money : null;
  });

  readonly preview = computed<string | null>(() => {
    const money = this.parsedMoney();
    if (money === null) return null;
    const verb = this.type === 'income' ? 'un ingreso' : 'un gasto';
    return `Vas a registrar ${verb} de ${formatMoney(money)} en ${this.account.name}`;
  });

  readonly negativeWarning = computed<boolean>(() => {
    const money = this.parsedMoney();
    if (money === null) return false;
    return leavesNegative(this.type, this.data.row.available, money);
  });

  readonly submitError = computed<string | null>(() => {
    const s = this.store.state();
    if (s.status !== 'error') return null;
    if (s.error.kind === 'network' || s.error.kind === 'invalid-response') {
      return uncertainResultMessage('movimiento');
    }
    return errorMessage(s.error);
  });

  /** True when the error leaves the result uncertain (show the review link). */
  readonly uncertain = computed<boolean>(() => {
    const s = this.store.state();
    return s.status === 'error' && (s.error.kind === 'network' || s.error.kind === 'invalid-response');
  });

  constructor() {
    void this.categoryStore.loadOnce();

    // Block closing while the request is in flight (Escape, backdrop and the
    // close button are all gated on submitting()).
    effect(() => {
      this.dialogRef.disableClose = this.store.submitting();
    });

    // A validation 400 highlights the offending controls (category/description).
    effect(() => {
      const s = this.store.state();
      untracked(() => {
        if (s.status === 'error' && s.error.kind === 'validation') {
          for (const f of s.error.fields) {
            const control = this.controlFor(f.field);
            control?.setErrors({ server: true });
            control?.markAsTouched();
          }
        }
      });
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

  private controlFor(field: string) {
    if (field === 'category') return this.form.controls.category;
    if (field === 'description') return this.form.controls.description;
    return null;
  }

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.focusFirstInvalid();
      return;
    }

    const money = this.parsedMoney();
    if (money === null) {
      // Defensive: the validator keeps the form invalid when money is null, so
      // this is unreachable, but it keeps the type narrow.
      this.focusFirstInvalid();
      return;
    }

    const description = this.form.controls.description.value.trim();
    const category = this.form.controls.category.value;

    const created = await this.store.submit({
      accountId: this.account.id,
      type: this.type,
      amount: money,
      ...(category !== '' ? { category } : {}),
      ...(description !== '' ? { description } : {}),
    });

    if (created) {
      this.snackBar.open('Movimiento registrado.', 'Cerrar', { duration: 5000 });
      this.dialogRef.close({ created: true });
    }
  }

  cancel(): void {
    if (this.store.submitting()) return; // cannot abandon an in-flight request
    this.dialogRef.close({ created: false });
  }

  /** Navigates to the account's transactions (from the uncertain-result link)
   *  and closes the dialog so the result is visible underneath. */
  goToTransactions(): void {
    this.dialogRef.close({ created: false });
    void this.router.navigate(['/transactions'], { queryParams: { account: this.account.id } });
  }

  private focusFirstInvalid(): void {
    const first = this.fields().find((f) =>
      f?.nativeElement?.querySelector('.ng-invalid, [aria-invalid="true"]'),
    );
    first?.nativeElement?.querySelector<HTMLElement>('input, mat-select, [tabindex]')?.focus();
  }
}

// Local helper to expose a FormControl's value as a signal.
import { toSignal } from '@angular/core/rxjs-interop';
import { type FormControl } from '@angular/forms';
function toSignalValue(control: FormControl<string>) {
  return toSignal(control.valueChanges, { initialValue: control.value });
}
