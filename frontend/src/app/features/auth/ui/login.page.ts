import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  inject,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { SessionStore } from '../application/session.store';
import { safeReturnUrl } from '../infrastructure/auth.guard';
import { ApiErrorException, type ApiError } from '../../../shared/domain/map-api-error';
import { errorMessage } from '../../../shared/ui/error-messages';

const DEFAULT_ROUTE = '/accounts';

/**
 * Login screen. A reactive form drives validation; business logic lives in the
 * session store. Three error kinds are surfaced: client validation (per field),
 * and server errors (invalid-credentials / network / other) as a form-level
 * alert whose text comes from the shared catalogue, never the raw API text.
 */
@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressBarModule,
  ],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly emailInput = viewChild<ElementRef<HTMLInputElement>>('emailInput');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  readonly submitting = signal(false);

  constructor() {
    // Move focus to the email field once, after the first render.
    afterNextRender(() => this.emailInput()?.nativeElement.focus());
  }
  /** Server-side error message (already translated), or null. */
  readonly serverError = signal<string | null>(null);

  async submit(): Promise<void> {
    this.serverError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.submitting()) {
      return; // guard against double submit
    }

    this.submitting.set(true);
    const { email, password } = this.form.getRawValue();
    try {
      await this.session.login(email, password);
      await this.router.navigateByUrl(this.resolveTarget());
    } catch (err) {
      this.serverError.set(this.messageFor(err));
    } finally {
      this.submitting.set(false);
    }
  }

  private messageFor(err: unknown): string {
    if (err instanceof ApiErrorException) {
      return errorMessage(err.error);
    }
    // Unexpected non-API error: generic message, the button is re-enabled by finally.
    const fallback: ApiError = { kind: 'unknown', status: 0 };
    return errorMessage(fallback);
  }

  private resolveTarget(): string {
    const raw = this.route.snapshot.queryParamMap.get('returnUrl');
    return safeReturnUrl(raw) ?? DEFAULT_ROUTE;
  }
}
