import { InjectionToken } from '@angular/core';

/**
 * Base URL of the mock API. Provided as an injection token so it can be
 * overridden per environment or in tests.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => 'http://localhost:3000',
});
