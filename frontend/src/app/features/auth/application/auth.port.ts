/**
 * Auth ports. Abstract classes so they double as DI tokens.
 *
 * Pure TypeScript: no `@angular/*`, no browser, no HTTP imports.
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

/** Result of a successful login: the token to persist and the user. */
export interface LoginResult {
  token: string;
  user: AuthUser;
}

export abstract class AuthPort {
  /** Logs in and returns the token + user. The store persists the token, not the adapter. */
  abstract login(email: string, password: string): Promise<LoginResult>;
  /** Validates the current token and returns the user (GET /auth/me). */
  abstract me(): Promise<AuthUser>;
}
