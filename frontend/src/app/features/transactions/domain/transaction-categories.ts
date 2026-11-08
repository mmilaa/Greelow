import { type TransactionType } from '../../../shared/domain/transaction';

/**
 * Which categories apply to a transaction type, as a client-side rule (the API
 * does not enforce type/category coherence). "transfer" is never offered for an
 * income/expense; "other" is always allowed.
 *
 * The result is the intersection of the allowed set with the real catalogue
 * coming from GET /categories, so a category the backend drops stops being
 * offered and an unknown one is ignored.
 *
 * Ordering: alphabetical by the Spanish label, with "other" ("Otros") pinned
 * last. The label function is injected so this stays pure domain (no import
 * from the UI layer).
 *
 * Pure TypeScript: no `@angular/*` imports.
 */

const ALLOWED: Record<TransactionType, readonly string[]> = {
  income: ['salary', 'freelance', 'other'],
  expense: ['rent', 'groceries', 'transport', 'entertainment', 'utilities', 'health', 'other'],
  // Transfers are not created from this form; no category selector for them.
  transfer: [],
};

export function categoriesFor(
  type: TransactionType,
  catalog: readonly string[],
  labelOf: (category: string) => string,
): string[] {
  const allowed = ALLOWED[type];
  const present = allowed.filter((c) => catalog.includes(c));

  return present.sort((a, b) => {
    // "other" always sinks to the end.
    if (a === 'other') return 1;
    if (b === 'other') return -1;
    return labelOf(a).localeCompare(labelOf(b), 'es');
  });
}
