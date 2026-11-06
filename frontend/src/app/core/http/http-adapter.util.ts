import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, type Observable } from 'rxjs';
import {
  mapApiError,
  ApiErrorException,
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
 *
 * This is the only place where HttpErrorResponse is interpreted.
 */
export async function runRequest<Raw, Out>(
  source: Observable<Raw>,
  operation: ApiOperation,
  map: (raw: Raw) => Out,
): Promise<Out> {
  let raw: Raw;
  try {
    raw = await firstValueFrom(source);
  } catch (err) {
    throw toApiErrorException(err, operation);
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

/** Converts an HttpErrorResponse (or anything) into an ApiErrorException. */
function toApiErrorException(err: unknown, operation: ApiOperation): ApiErrorException {
  if (err instanceof HttpErrorResponse) {
    const apiError = mapApiError({ status: err.status, body: err.error }, operation);
    return new ApiErrorException(apiError, { cause: err });
  }
  // Non-HTTP failure (unexpected): surface as a network-like unknown.
  return new ApiErrorException({ kind: 'unknown', status: 0 }, { cause: err });
}
