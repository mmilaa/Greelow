import { type Money } from '../../../shared/domain/money';
import { formatMoney } from '../../../shared/domain/format-money';
import { type ApiError } from '../../../shared/domain/map-api-error';
import { errorMessage, uncertainResultMessage } from '../../../shared/ui/error-messages';
import { type BlockReason } from '../application/transfer.store';

/**
 * Spanish user-facing text for the transfer feature. It lives in the feature's
 * UI layer (not shared/ui) because it depends on TransferBlockReason, which is a
 * transfers-domain type, and shared must not import from a feature.
 *
 * The store never holds Spanish text: it exposes typed outcomes (ApiError,
 * block reasons) and this catalog turns them into text, reusing the shared
 * catalog (errorMessage, uncertainResultMessage) wherever it already has the
 * right message.
 *
 * Pure TypeScript: no `@angular/*` imports.
 */

/**
 * Message for a blocked transfer. For `insufficient-funds`, the available
 * balance is appended when it is known (it always is in practice, since the
 * block comes from canTransfer which needs it). `available-unknown` and
 * `in-flight-from-account` are the store's own reasons, not policy reasons.
 */
export function transferBlockMessage(reason: BlockReason, available?: Money | null): string {
  switch (reason) {
    case 'same-account':
      return 'No podés transferir a la misma cuenta.';
    case 'non-positive-amount':
      return 'El monto debe ser mayor a cero.';
    case 'unknown-destination-currency':
      return 'Solo podés transferir a tus cuentas: no podemos verificar la moneda de una cuenta de otra persona.';
    case 'cross-currency':
      return 'No podés transferir entre cuentas de distinta moneda.';
    case 'insufficient-funds':
      return available != null
        ? `No tenés saldo disponible suficiente. Disponible: ${formatMoney(available)}.`
        : 'No tenés saldo disponible suficiente para esta transferencia.';
    case 'available-unknown':
      return 'No pudimos calcular el saldo disponible. Reintentá antes de transferir.';
    case 'in-flight-from-account':
      return 'Ya hay una transferencia en curso desde esta cuenta. Esperá a que termine.';
  }
}

/**
 * Message for a known create error (400/404/422/401). Reuses the shared error
 * catalog so the wording stays consistent; the raw API text is never shown.
 */
export function transferCreateErrorMessage(error: ApiError): string {
  return errorMessage(error);
}

/**
 * Message for an uncertain create result. A network error may or may not have
 * created the transfer (reuses the shared uncertain message). An
 * invalid-response means the server accepted it but we could not read its id to
 * follow it, so retrying is NOT offered (that text is only here).
 */
export function transferUncertainMessage(kind: 'network' | 'invalid-response'): string {
  if (kind === 'network') {
    return uncertainResultMessage('transferencia');
  }
  return (
    'El servidor aceptó la transferencia, pero no pudimos leer su identificador ' +
    'para seguir su estado. Revisá los movimientos de la cuenta; no vuelvas a ' +
    'enviarla para no duplicarla.'
  );
}

/** Message shown while a transfer is being tracked. */
export function transferTrackingMessage(): string {
  return 'Procesando la transferencia...';
}

/** Message when a transfer is confirmed (completed). */
export function transferConfirmedMessage(): string {
  return 'Transferencia completada.';
}

/** Message when a transfer ended in failed. */
export function transferFailedMessage(): string {
  return 'La transferencia falló.';
}

/** Message when polling was exhausted without a terminal status. */
export function transferUnconfirmedMessage(): string {
  return 'No pudimos confirmar la transferencia. Verificá su estado más tarde.';
}

/** Aside shown when the verification read (after an uncertain create) itself failed. */
export function verificationFailedNotice(): string {
  return 'No pudimos leer los movimientos de la cuenta para verificar. Revisalos manualmente.';
}

/** Short reason shown on a disabled destination option (and in the hint). */
export function destinationIneligibleReason(reason: 'same-account' | 'cross-currency'): string {
  return reason === 'same-account' ? 'Es la cuenta de origen' : 'Moneda distinta';
}
