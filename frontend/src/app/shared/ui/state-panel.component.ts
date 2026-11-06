import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export type PanelState = 'loading' | 'error' | 'empty';

/**
 * The loading / error (with retry) / empty states every data screen needs.
 * Presentational only: the retry output is wired by the caller.
 */
@Component({
  selector: 'app-state-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatButtonModule, MatProgressSpinnerModule],
  template: `
    <div class="panel" role="status" aria-live="polite">
      @switch (state()) {
        @case ('loading') {
          <mat-progress-spinner mode="indeterminate" diameter="40" />
          <p class="panel__text">{{ loadingText() }}</p>
        }
        @case ('empty') {
          <mat-icon class="panel__icon" aria-hidden="true">inbox</mat-icon>
          <p class="panel__text">{{ emptyText() }}</p>
        }
        @case ('error') {
          <mat-icon class="panel__icon panel__icon--error" aria-hidden="true">error</mat-icon>
          <p class="panel__text">{{ errorText() }}</p>
          <button mat-stroked-button type="button" (click)="retry.emit()">Reintentar</button>
        }
      }
    </div>
  `,
  styleUrl: './state-panel.component.scss',
})
export class StatePanelComponent {
  readonly state = input.required<PanelState>();
  readonly loadingText = input('Cargando…');
  readonly emptyText = input('No hay nada para mostrar.');
  readonly errorText = input('No pudimos cargar los datos.');
  readonly retry = output<void>();
}
