import {
  type TransactionType,
  type TransactionDirection,
} from '../domain/transaction';

/**
 * Spanish label for a transaction, from its type and direction. A transfer is
 * "enviada"/"recibida" depending on the leg direction.
 *
 * Exhaustive switch (no default) so the compiler flags any new type.
 */
export function transactionTypeLabel(
  type: TransactionType,
  direction: TransactionDirection,
): string {
  switch (type) {
    case 'income':
      return 'Ingreso';
    case 'expense':
      return 'Gasto';
    case 'transfer':
      return direction === 'in' ? 'Transferencia recibida' : 'Transferencia enviada';
  }
}

/** The fixed API categories (docs/api-samples/20-categories.json). */
type KnownCategory =
  | 'salary'
  | 'freelance'
  | 'rent'
  | 'groceries'
  | 'transport'
  | 'entertainment'
  | 'utilities'
  | 'health'
  | 'transfer'
  | 'other';

const KNOWN: readonly KnownCategory[] = [
  'salary',
  'freelance',
  'rent',
  'groceries',
  'transport',
  'entertainment',
  'utilities',
  'health',
  'transfer',
  'other',
];

function isKnown(category: string): category is KnownCategory {
  return (KNOWN as readonly string[]).includes(category);
}

/** Spanish label for a known category. Exhaustive switch (no default). */
function knownCategoryLabel(category: KnownCategory): string {
  switch (category) {
    case 'salary':
      return 'Sueldo';
    case 'freelance':
      return 'Freelance';
    case 'rent':
      return 'Alquiler';
    case 'groceries':
      return 'Supermercado';
    case 'transport':
      return 'Transporte';
    case 'entertainment':
      return 'Entretenimiento';
    case 'utilities':
      return 'Servicios';
    case 'health':
      return 'Salud';
    case 'transfer':
      return 'Transferencia';
    case 'other':
      return 'Otros';
  }
}

/**
 * Spanish label for a category string. Unknown categories (the API could add
 * one) are shown raw with their first letter capitalized, so the row never
 * breaks and no information is hidden.
 */
export function categoryLabel(category: string): string {
  if (isKnown(category)) {
    return knownCategoryLabel(category);
  }
  if (category.length === 0) {
    return 'Otros';
  }
  return category.charAt(0).toUpperCase() + category.slice(1);
}
