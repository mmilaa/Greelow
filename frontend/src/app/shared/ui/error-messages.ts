import { type ApiError } from '../domain/map-api-error';

/**
 * Spanish user-facing messages for each domain error kind. This is the single
 * place where an ApiError becomes text shown to the user; the raw English text
 * from the API is never displayed.
 *
 * For `validation` the message is general (option b): the form highlights the
 * offending fields using `ApiError.fields`, so no per-field text is rendered here.
 */
export function errorMessage(error: ApiError): string {
  switch (error.kind) {
    case 'validation':
      return 'Revisá los datos ingresados.';
    case 'same-account':
      return 'No podés transferir a la misma cuenta.';
    case 'insufficient-funds':
      return 'No tenés saldo disponible suficiente para esta transferencia.';
    case 'not-found':
      return 'No encontramos lo que buscás.';
    case 'invalid-credentials':
      return 'El email o la contraseña son incorrectos.';
    case 'unauthenticated':
      return 'Tu sesión expiró. Volvé a iniciar sesión.';
    case 'network':
      return 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.';
    case 'invalid-response':
      return 'Recibimos una respuesta inesperada del servidor. Intentá de nuevo.';
    case 'unknown':
      return 'Ocurrió un error inesperado. Intentá de nuevo.';
  }
}
