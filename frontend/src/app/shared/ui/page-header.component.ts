import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Consistent page header: an h1 title plus a projected slot for actions.
 * Presentational only.
 */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-header">
      <h1 class="page-header__title">{{ title() }}</h1>
      <div class="page-header__actions">
        <ng-content></ng-content>
      </div>
    </header>
  `,
  styleUrl: './page-header.component.scss',
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
}
