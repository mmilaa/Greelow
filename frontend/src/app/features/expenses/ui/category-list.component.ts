import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MoneyAmountComponent } from '../../../shared/ui/money-amount.component';
import { categoryLabel } from '../../../shared/ui/transaction-labels';
import { type CategorySummary } from '../domain/summarize-expenses';

/** A row ready to render: the domain summary plus its Spanish label. */
interface CategoryRow extends CategorySummary {
  label: string;
}

/**
 * The ordered list of expense categories. Presentational only: it takes the
 * already-summarized categories and renders, for each, the Spanish label, the
 * amount (MoneyAmount) and a CSS bar.
 *
 * Two parallel representations:
 * - A real <table> with a caption is the accessible one (Categoría / Monto).
 * - The bars are decorative (aria-hidden): one token colour (--color-primary)
 *   over a token surface, width from the share. They never carry meaning alone.
 */
@Component({
  selector: 'app-category-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyAmountComponent],
  templateUrl: './category-list.component.html',
  styleUrl: './category-list.component.scss',
})
export class CategoryListComponent {
  readonly categories = input.required<CategorySummary[]>();
  /** The accessible caption, e.g. "Gastos por categoría, ARS, octubre de 2026". */
  readonly caption = input.required<string>();

  readonly rows = computed<CategoryRow[]>(() =>
    this.categories().map((c) => ({ ...c, label: categoryLabel(c.category) })),
  );

  /** Bar width as a percentage string; clamps to [0, 100]. */
  barWidth(share: number): string {
    const pct = Math.max(0, Math.min(1, share)) * 100;
    return `${pct}%`;
  }
}
