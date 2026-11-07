/**
 * Port for the fixed category list. Abstract class so it doubles as a DI token.
 * Stays in the transactions feature (no separate categories feature).
 *
 * Pure TypeScript: no `@angular/*` imports.
 */
export abstract class CategoryPort {
  abstract list(): Promise<string[]>;
}
