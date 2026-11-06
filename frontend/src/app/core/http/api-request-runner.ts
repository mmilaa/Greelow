import { Injectable, Injector, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import { type ApiOperation } from '../../shared/domain/map-api-error';
import { runRequest } from './http-adapter.util';
import { ON_UNAUTHENTICATED } from './on-unauthenticated.token';

/**
 * Injectable wrapper around runRequest. Behaviour is identical to calling
 * runRequest directly.
 *
 * ON_UNAUTHENTICATED is resolved lazily (via the Injector, at call time) rather
 * than in a field initializer: its factory reaches the SessionStore, which
 * depends on AuthPort -> AuthHttpAdapter -> this runner. Resolving it eagerly
 * would form a construction-time cycle; resolving it on demand breaks it.
 */
@Injectable({ providedIn: 'root' })
export class ApiRequestRunner {
  private readonly injector = inject(Injector);

  run<Raw, Out>(
    source: Observable<Raw>,
    operation: ApiOperation,
    map: (raw: Raw) => Out,
  ): Promise<Out> {
    const onUnauthenticated = this.injector.get(ON_UNAUTHENTICATED);
    return runRequest(source, operation, map, onUnauthenticated);
  }
}
