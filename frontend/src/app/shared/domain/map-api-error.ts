/**
 * Maps a raw API error response to a typed domain error, using status + body
 * shape + operation context. It NEVER branches on the human-readable message
 * text (which comes from the API in English and is never shown to the user).
 *
 * Pure TypeScript: no `@angular/*` imports. Side effects (clearing the session,
 * redirecting on 401) belong to the HTTP interceptor, not here.
 */

/** Context of the operation that triggered the request. */
export type ApiOperation =
  | 'login'
  | 'create-transfer'
  | 'create-transaction'
  | 'create-account'
  | 'read';

/** API response stripped of any Angular type (e.g. HttpErrorResponse). */
export interface ApiErrorResponse {
  /** HTTP status. 0 means the request never reached the server (no network). */
  status: number;
  body: unknown;
}

/** A per-field error from a `{ errors: [...] }` body. `message` is raw API text. */
export interface FieldError {
  field: string;
  message: string;
}

/**
 * Typed domain error. Discriminated by `kind`; the UI maps each kind to Spanish text.
 *
 * `invalid-response` is not produced by `mapApiError` (a 2xx response cannot be an
 * error at the HTTP level). The infrastructure adapter produces it when a 2xx body
 * fails to map to the domain (an InvalidDataError), so application sees a single
 * error family (ApiErrorException) regardless of where the failure happened.
 */
export type ApiError =
  | { kind: 'validation'; fields: FieldError[] }
  | { kind: 'same-account' }
  | { kind: 'insufficient-funds' }
  | { kind: 'not-found' }
  | { kind: 'invalid-credentials' }
  | { kind: 'unauthenticated' }
  | { kind: 'network' }
  | { kind: 'invalid-response' }
  | { kind: 'unknown'; status: number };

/**
 * The single exception type thrown across the infrastructure boundary toward
 * application. Carries the typed `ApiError` and, when it wraps another error
 * (e.g. an InvalidDataError from a corrupt 2xx body), the original as `cause`.
 */
export class ApiErrorException extends Error {
  constructor(
    readonly error: ApiError,
    options?: { cause?: unknown },
  ) {
    super(`ApiError: ${error.kind}`, options);
    this.name = 'ApiErrorException';
  }
}

/** Narrows a body of the shape `{ errors: [{ field, message }, ...] }`. */
function hasFieldErrors(body: unknown): body is { errors: FieldError[] } {
  if (typeof body !== 'object' || body === null || !('errors' in body)) {
    return false;
  }
  const errors = (body as { errors: unknown }).errors;
  return (
    Array.isArray(errors) &&
    errors.every(
      (e) =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as FieldError).field === 'string' &&
        typeof (e as FieldError).message === 'string',
    )
  );
}

/** Narrows a body of the shape `{ error: "..." }`. */
function hasErrorString(body: unknown): body is { error: string } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as { error: unknown }).error === 'string'
  );
}

/** Classifies an API error response into a typed domain error. */
export function mapApiError(response: ApiErrorResponse, operation: ApiOperation): ApiError {
  const { status, body } = response;

  // No network / server unreachable.
  if (status === 0) {
    return { kind: 'network' };
  }

  switch (status) {
    case 400:
      // A non-empty field-error array is a validation error, regardless of context.
      if (hasFieldErrors(body) && body.errors.length > 0) {
        return { kind: 'validation', fields: body.errors };
      }
      // `{ error }` on a transfer means source === destination.
      if (hasErrorString(body) && operation === 'create-transfer') {
        return { kind: 'same-account' };
      }
      return { kind: 'unknown', status };

    case 401:
      // 401 during login is bad credentials; anywhere else it is a dead session.
      return operation === 'login'
        ? { kind: 'invalid-credentials' }
        : { kind: 'unauthenticated' };

    case 404:
      return { kind: 'not-found' };

    case 422:
      // The API documents 422 (insufficient funds) only for transfers.
      return operation === 'create-transfer'
        ? { kind: 'insufficient-funds' }
        : { kind: 'unknown', status };

    default:
      return { kind: 'unknown', status };
  }
}
