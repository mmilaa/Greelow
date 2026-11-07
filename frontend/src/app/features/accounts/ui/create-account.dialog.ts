import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
} from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { AccountsStore } from '../../../shared/application/accounts.store';
import { CURRENCIES, type Currency } from '../../../shared/domain/currency';
import { ApiErrorException, type ApiError } from '../../../shared/domain/map-api-error';
import { errorMessage } from '../../../shared/ui/error-messages';

/** Validates length on the trimmed value (so "  " or " a " are rejected). */
function trimmedLength(min: number, max: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const len = (control.value ?? '').trim().length;
    if (len < min) return { trimmedMin: { min } };
    if (len > max) return { trimmedMax: { max } };
    return null;
  };
}

/** Result returned when an account was created. */
export interface CreateAccountResult {
  refreshed: boolean;
}

@Component({
  selector: 'app-create-account-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  templateUrl: './create-account.dialog.html',
  styleUrl: './create-account.dialog.scss',
})
export class CreateAccountDialog {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(AccountsStore);
  private readonly dialogRef = inject(MatDialogRef<CreateAccountDialog, CreateAccountResult>);

  readonly currencies = CURRENCIES;
  readonly submitting = signal(false);
  readonly serverError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, trimmedLength(2, 100)]],
    currency: ['' as Currency | '', [Validators.required]],
  });

  async submit(): Promise<void> {
    this.serverError.set(null);
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    const { name, currency } = this.form.getRawValue();
    try {
      const result = await this.store.create({ name: name.trim(), currency: currency as Currency });
      this.dialogRef.close(result);
    } catch (err) {
      this.serverError.set(this.messageFor(err));
      this.submitting.set(false); // keep the dialog open to retry
    }
  }

  cancel(): void {
    this.dialogRef.close();
  }

  private messageFor(err: unknown): string {
    if (err instanceof ApiErrorException) {
      return errorMessage(err.error);
    }
    const fallback: ApiError = { kind: 'unknown', status: 0 };
    return errorMessage(fallback);
  }
}
