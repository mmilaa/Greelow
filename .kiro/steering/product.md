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
- Errores: 400 -> { errors: [{ field, message }] }; 422 -> { error: "Insufficient funds in source account" };
  401 sin token. Son DOS formas de cuerpo distintas.
- El saldo no cambia mientras la transferencia está `pending`; baja al pasar a `completed`.
- La API NO convierte monedas: una transferencia ARS->USD de 5000 acreditó 5000 USD.
- La API permite sobregiro: dos transferencias rápidas que juntas superan el saldo
  se aceptan ambas y dejan el saldo negativo (race condition).

Según el README, NO probado todavía (tratar con tolerancia):
- Una transferencia puede traer `from` o `to` en null (cada usuario ve solo su lado).
- status puede ser `failed` (el filtro lo acepta; el seed no lo genera).
- counterpartAccountId y transferId pueden ser null.
- pageSize máx 50. La moneda de una cuenta es inmutable. Las transferencias no se editan (400).
- GET /categories devuelve la lista fija de categorías: usarlo para el selector.
- 404: recurso inexistente o ajeno.

## Decisiones de producto (ya tomadas; se documentan en DECISIONS.md)
1. Multi-moneda: BLOQUEAR transferencias entre monedas distintas, en dominio y en UI,
   con mensaje claro. Evidencia: docs/api-samples/04-transfer-cross-currency.json.
   Bonus futuro: conversión aproximada.
2. Async: la transferencia nace `pending` y pasa a `completed` en ~1,5 s. Mostrar badge
   "Procesando" y hacer polling corto y ACOTADO (intervalo ~1 s, máx. N intentos), más
   refresco al volver a la pantalla. Nunca polling infinito. Si se agotan los intentos,
   mostrar "no pudimos confirmar" con acción de refrescar.
3. Fondos insuficientes: validar antes de enviar contra el SALDO DISPONIBLE y manejar
   igual el 422.
4. Saldo contable = `balance` de la API. Saldo disponible = contable - suma de
   transferencias salientes `pending` de esa cuenta.
   La validación del cliente es la única defensa contra el sobregiro
   (docs/api-samples/06-race-condition.txt) y solo protege a quien usa esta app.
   Por eso: refrescar saldo y pendientes antes de validar y bloquear el envío mientras
   haya una transferencia en vuelo desde esa cuenta.
5. Representar `failed` en la UI aunque el seed no lo genere.
6. Soportar saldo negativo sin romper la UI.
7. Transferir a otra persona: el usuario ingresa el ID de la cuenta destino (no hay
   endpoint de búsqueda). Supuesto a documentar.

## Estados de UI obligatorios
Toda pantalla con datos remotos muestra loading, error (con reintento) y vacío.