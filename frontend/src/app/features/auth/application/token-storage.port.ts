/**
 * Abstraction over token persistence, so application never touches the browser.
 * The infrastructure adapter implements it with sessionStorage (with an
 * in-memory fallback if sessionStorage throws).
 *
 * Pure TypeScript: no `@angular/*`, no browser imports.
 */
export abstract class TokenStoragePort {
  abstract get(): string | null;
  abstract set(token: string): void;
  abstract clear(): void;
}
