import { ApplicationConfig, type Provider, type EnvironmentProviders, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { dataAccessProviders } from './app.providers';
import { authInterceptor } from './features/auth/infrastructure/auth.interceptor';

/**
 * The app's real providers. Exported so integration tests can use the exact
 * same wiring (interceptor + ON_UNAUTHENTICATED) and only swap the HTTP backend.
 */
export const appProviders: (Provider | EnvironmentProviders)[] = [
  provideBrowserGlobalErrorListeners(),
  provideRouter(routes),
  provideHttpClient(withInterceptors([authInterceptor])),
  dataAccessProviders,
];

export const appConfig: ApplicationConfig = {
  providers: appProviders,
};
