import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, type Observable } from 'rxjs';
import {
  mapApiError,
  ApiErrorException,
  type ApiError,
  type ApiOperation,
} from '../../shared/domain/map-api-error';
import { InvalidDataError } from '../../shared/domain/errors';

/**
 * Runs an HTTP call and maps its result into the domain, translating every
 * failure into a single ApiErrorException family:
 *
 * - HTTP failures (HttpErrorResponse, incl. status 0) are reduced to
 *   { status, body } and classified by mapApiError with the operation context.
 * - A successful response whose body fails to map (InvalidDataError thrown by
 *   `map`) becomes an 'invalid-response' ApiErrorException with the original as
 *   cause, so a corrupt 2xx is never swallowed.
 * - When the classified error is `unauthenticated` (a 401 outside login) and an
 *   `onUnauthenticated` callback is given, it is invoked (the session expires).
 *
 * This is the only place where HttpErrorResponse is interpreted. The adapter
 * passes `onUnauthenticated` (captured via inject in a field initializer), so
 * this function itself never calls inject.
 */
export async function runRequest<Raw, Out>(
  source: Observable<Raw>,
  operation: ApiOperation,
  map: (raw: Raw) => Out,
  onUnauthenticated?: () => void,
): Promise<Out> {
  let raw: Raw;
  try {
    raw = await firstValueFrom(source);
  } catch (err) {
    throw classifyAndSignal(err, operation, onUnauthenticated);
  }

  try {
    return map(raw);
  } catch (err) {
    if (err instanceof InvalidDataError) {
      throw new ApiErrorException({ kind: 'invalid-response' }, { cause: err });
    }
    throw err;
  }
}

/** Classifies an HttpErrorResponse and fires the unauthenticated side effect. */
function classifyAndSignal(
  err: unknown,
  operation: ApiOperation,
  onUnauthenticated?: () => void,
): ApiErrorException {
  const apiError: ApiError =
    err instanceof HttpErrorResponse
      ? mapApiError({ status: err.status, body: err.error }, operation)
      : { kind: 'unknown', status: 0 };

  if (apiError.kind === 'unauthenticated') {
    onUnauthenticated?.();
  }
  return new ApiErrorException(apiError, { cause: err });
}
