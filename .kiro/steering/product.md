# Producto: Billetera virtual personal

Ejercicio técnico de Frontend (fintech). Una billetera para UN usuario autenticado:
login, cuentas con saldo, movimientos (filtro, búsqueda, paginación), alta de
ingreso/gasto y transferencias. Pocas pantallas, bien resueltas.
Se evalúa criterio con dinero, estados, errores y desacoplamiento.

## API (mock-api/, caja negra: NO modificarla)
Base: http://localhost:3000. Auth: `Authorization: Bearer <token>`.
Referencia: mock-api/README.md. Respuestas reales en docs/api-samples/.

Verificado probando la API:
- Login: POST /auth/login -> { token, user: { id, email, name } }. Token mock `fake-token-<userId>`.
- Respuestas envueltas: { accounts }, { transactions, pagination }, { transfer }.
- Paginación: { page, pageSize, total }. NO hay totalPages: se calcula en dominio.
- Montos: number, admite decimales (probado con 12.34). Cada movimiento trae su propio `currency`.
- Movimiento: type income|expense|transfer; direction "in"|"out"|null (null en ingresos/gastos).
- Errores: 400 -> { errors: [{ field, message }] }; 422 -> { error: "Insufficient funds in source account" }; 401 sin token. Son DOS formas de cuerpo distintas.
- El saldo no cambia mientras la transferencia está `pending`; baja al pasar a `completed`.
- La API NO convierte monedas: una transferencia ARS->USD de 5000 acreditó 5000 USD.
- La API permite sobregiro: dos transferencias rápidas que juntas superan el saldo   se aceptan ambas y dejan el saldo negativo (race condition).
- POST /transfers devuelve el lado `to` completo, incluso si la cuenta es de otro
  usuario. GET /transfers/:id devuelve ese lado en `null`.
- Transferir a la misma cuenta devuelve 400 con `{ error: "Cannot transfer to the same account" }`.
- Transferir a una cuenta inexistente devuelve 404 con `{ error: "Destination account not found" }`.
- GET /accounts/:id de una cuenta ajena devuelve 404: la moneda de un destino de otro usuario es desconocida antes de enviar.
- Fechas: createdAt llega en ISO UTC y se muestra en hora local con formato es-AR "4 nov 2026, 11:00 p. m.". Los tests de fecha pasan la zona horaria explícita.
- Los movimientos pending o failed se muestran con el monto atenuado y el chip de estado,  nunca como si fueran dinero movido.
- createdAt debe ser ISO 8601 con Z u offset. Un string sin zona se rechaza (InvalidDataError), porque se interpretaría en la zona local del navegador y correría las horas.
- POST /accounts devuelve { account } con balance 0 (samples 25 y 26). Los ids nuevos son
  "acc-" más un número largo: no asumir ids cortos.
- 401: en login con credenciales incorrectas { error: "Invalid email or password" }; sin
  token o con token inválido { error: "..." }. Se distinguen por operación, no por texto.
- El listado de transacciones llega de la más nueva a la más vieja (verificado en el seed;
  el README no lo promete).
- GET /transactions sin accountId devuelve las de todas las cuentas del usuario (sample 24).

Según el README, NO probado todavía (tratar con tolerancia):
- status puede ser `failed` (el filtro lo acepta; el seed no lo genera).
- pageSize máx 50. La moneda de una cuenta es inmutable. Las transferencias no se editan (400).
- 404: recurso inexistente o ajeno.

## Pantallas
- /accounts: tarjetas con nombre, moneda y saldo (sin número de cuenta, la API no lo tiene)
  y "Nueva cuenta". /accounts/:id: la tarjeta, la acción Transferir y los últimos 5
  movimientos. /transactions?account=: selector de cuenta, filtros y paginación.
  /transfers?from=: origen preseleccionado. Los parámetros de la URL se validan siempre
  contra las cuentas del usuario; si no coinciden, se ignoran.
- Las transferencias no llevan categoría (la API la fija en "transfer"): la categoría es de
  los ingresos y gastos. No hay filtro por fecha: la API no lo soporta.

## Cuentas
- Se pueden crear (nombre recortado de 2 a 100 caracteres y moneda). No se editan ni se
  borran. Nacen con saldo 0. La moneda no se puede cambiar, así que el formulario no tiene
  moneda por defecto y lo avisa.
- Las cuentas se identifican por su id de la API, que se muestra completo como "ID de cuenta"
(en una esquina de la tarjeta y debajo del nombre en el detalle) y donde se elige una cuenta.
Los nombres pueden repetirse: lo que distingue una cuenta de otra es el id.

## Decisiones de producto (ya tomadas; se documentan en DECISIONS.md)
1. Multi-moneda: BLOQUEAR transferencias entre monedas distintas, en dominio y en UI,
   con mensaje claro. Evidencia: docs/api-samples/04-transfer-cross-currency.json.
   Bonus futuro: conversión aproximada.
2. Async: la transferencia nace `pending` y pasa a `completed` en ~1,5 s. Mostrar badge
   "Procesando" y hacer polling corto y ACOTADO 6 intentos cada 1 segundo, el primero después del primer intervalo. Un fallo al consultar se trata como pendiente; si se agotan, ‘no pudimos confirmar’. Un 401 no se reintenta.
3. Fondos insuficientes: validar antes de enviar contra el SALDO DISPONIBLE y manejar
   igual el 422.
4. Saldo contable = `balance` de la API. Saldo disponible = contable - suma de
   transferencias salientes `pending` de esa cuenta.
   La validación del cliente es la única defensa contra el sobregiro
   (docs/api-samples/06-race-condition.txt) y solo protege a quien usa esta app.
   Por eso: refrescar saldo y pendientes antes de validar y bloquear el envío mientras
   haya una transferencia en vuelo desde esa cuenta. Se leen los pendientes primero y los saldos después, en secuencia. Si no se pueden leer los pendientes, se muestra solo el saldo contable con un aviso, nunca un disponible calculado con datos incompletos
5. Representar `failed` en la UI aunque el seed no lo genere.
6. Soportar saldo negativo sin romper la UI.
7. Transferencias: el usuario elige entre las cuentas propias, las cuentas de otros usuarios no están disponibles por no poder verificar su tipo de moneda.

## Estados de UI obligatorios
Toda pantalla con datos remotos muestra loading, error (con reintento) y vacío.