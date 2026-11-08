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

/** Grammatical noun for the uncertain-result message. */
export type UncertainNoun = 'movimiento' | 'transferencia';

/**
 * Message for a network / invalid-response failure on a create operation, where
 * we cannot know whether the server actually recorded it. Parametrized by noun
 * so both the new-transaction and the transfer screens reuse it; the page adds
 * the link to review the account's transactions.
 */
export function uncertainResultMessage(noun: UncertainNoun): string {
  return `No pudimos confirmar si ${
    noun === 'transferencia' ? 'la transferencia' : 'el movimiento'
  } se registró. Revisá los movimientos de la cuenta antes de reintentar.`;
}

/** Spanish message for an amount parse error (new-transaction / transfer forms). */
export function amountErrorMessage(
  reason: 'empty' | 'invalid-format' | 'too-many-decimals' | 'not-positive' | 'too-large',
): string {
  switch (reason) {
    case 'empty':
      return 'Ingresá un monto.';
    case 'invalid-format':
      return 'El monto no es válido. Usá solo números con coma o punto.';
    case 'too-many-decimals':
      return 'Usá hasta 2 decimales y no uses punto de miles (por ejemplo 1234,56).';
    case 'not-positive':
      return 'El monto debe ser mayor a cero: el tipo define si suma o resta.';
    case 'too-large':
      return 'El monto es demasiado grande.';
  }
}
