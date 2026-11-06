## #00 · Planificación y exploración previa
**Herramienta:** Claude

**Tipo de uso:** conversación iterativa de planificación.

**Temas:** alcance del producto, exploración de la API, decisiones de producto,
arquitectura, redacción del steering.

### Lo que hice yo
- Levanté el mock-api y exploré la API con Postman: login, listado de cuentas y movimientos con paginación,
  una transferencia ARS -> USD y un monto excesivo para provocar el 422.
- Con PowerShell (`Invoke-RestMethod`) hice las pruebas que requerían varias llamadas
  seguidas o control de tiempos: timing de la liquidación, doble transferencia,
  gasto con decimales y los errores 400 y 401.

### Decisiones

| # | Tema | Propuesta de la IA | Mi decisión | Por qué |
|---|---|---|---|---|
| 1 | Producto | Billetera con pocas pantallas | ✅ Aceptado. | Una billetera con las funcionalidades pedidas no necesita muchas pantallas distintas |
| 2 | Multi-moneda | Bloquear transferencias entre monedas distintas | ✅ Aceptado | En una primera versión se bloquean; después se puede mejorar permitiéndolas con conversión de moneda |
| 3 | Sobregiro | Saldo disponible = contable menos pendientes salientes, y bloquear envíos en vuelo | ✅ Aceptado | Al probar dos transferencias seguidas, la API aceptó ambas y la cuenta quedó en negativo, así que no alcanza con confiar en el 422 |
| 4 | Estructura | Arquitectura híbrida por feature, con 4 capas dentro de cada una | ✏️ La cuestioné por complejidad, pero la acepté | Si bien el proyecto es chico y al principio me pareció una estructura un poco compleja para el alcance de la prueba, decidí mantener las cuatro capas para separar mejor las responsabilidades. Me parece importante que la lógica de negocio no dependa de Angular ni de cómo se consumen los datos de la API, y que se pueda probar de forma independiente. |
| 5 | `docs/api-samples/` | Guardar las pruebas de la API para referenciarlas desde el steering | ✅ Aceptado | Las pruebas mostraron comportamientos que el README no describe, como el sobregiro con dos transferencias seguidas y la forma exacta de los errores, y quise dejarlos como evidencia |

### Sobre el steering
Los tres archivos de `.kiro/steering/` los redactó la IA en esta conversación.

## #01 · Lectura del steering por Kiro
**Herramienta:** Kiro 

**Prompt:** Leé el steering de .kiro/steering/ y mock-api/README.md. Todavía no escribas
código ni modifiques archivos. Confirmame qué entendiste del proyecto, señalame
contradicciones o huecos que veas en el steering, y listame las preguntas que
necesitás que te responda antes de empezar.

**Resultado:** entendió el alcance y las decisiones, y detectó huecos: origen de los
pending salientes, factor de decimales de Money, runner de tests, alcance de cuentas.

**Decisión:** ✅ aceptado, respondí sus preguntas en el #02.

**Por qué:** La idea es que Kiro entienda el proyecto y encuentre inconsistencias antes de empezar a implementar, como sí las encontró, respondí sus preguntas.

## #02 · Respuestas a Kiro y arranque del dominio 
**Herramienta:** Kiro 

**Prompt:**
> Respuestas:
> 1. Formularios: Reactive Forms.
> 2. Sí, verificá que `ng test` corre Vitest ejecutándolo una vez. No toques nada más.
> 3. Money: mapa de decimales por moneda en Currency (ARS=2, USD=2, EUR=2).
> 4. Orden: arrancamos por el dominio compartido (Money, Currency, errores).
>    Primero escribí SOLO los tests y esperá mi revisión antes de implementar.
> 5. Los pending salientes se leen de GET /transactions?status=pending&type=transfer
>    filtrando direction === "out" (el README no tiene listado de /transfers).
> 6. Cuentas: solo lectura, sin alta ni edición.
> 7. Este fue el prompt #01; el próximo commit usa #02.
> Todavía no implementes nada: solo los tests de Money y Currency.

**Resultado:** Kiro verificó que `ng test` corre Vitest 5.1.0, creó `currency.spec.ts` y `money.spec.ts` y no implementó nada, como le pedí.

**Decisión:** ✅ aceptado
**Por qué:** Acepté los archivos de test que creó pero considerando que hay que limitar los decimales que ingrese el usuario a 2.

## #03 · Implementación mínima del dominio compartido Money y Currency
**Herramienta:** Kiro

**Prompt:**
> Los tests de Money y Currency quedan aprobado como están, implementá lo mínimo
> para que pasen: currency.ts, money.ts, y errors.ts en shared/domain, sin
> formatMoney todavia. Corré ng test y mostrame el resultado. Si ves un caso
> border que no cubren los tests, no lo implementes aun, listamelos.

**Resultado:** Kiro implementó `currency.ts`, `errors.ts` y `money.ts`, sin formatMoney. `ng test` quedó en 28/28 verde (6 Currency + 20 Money + 2 scaffold), exit 0.

Casos borde que detectó y NO implementó aún: entradas NaN/Infinity en fromDecimal; fromMinor con -0; overflow más allá de MAX_SAFE_INTEGER; error de dominio tipado para fromMinor no-entero (hoy tira Error genérico); operaciones faltantes (times/sum/negate/abs); drift flotante en toDecimal para valores no probados.

**Decisión:** ✏️ modificado
**Por qué:** Respetó el alcance de lo pedido. Con respecto a los casos border, acepté agregar los de entradas inválidas y -0 porque me parecían necesarios. Los demás no lo son por ahora.


## #04 · Casos borde de Money (entradas inválidas y -0)
**Herramienta:** Kiro

**Prompt:**
> Con respecto a las preguntas anteriores, sí agrega tests para:
> 1. Si deberia lanzar error
> 2. Normalizar a 0, considerando también el caso -0.004
> 3. Si, usar isSafeInteger
> 4. Si, que no haya error generico, InvalidAmountError para valores inválidos
> 5. No por ahora
> 6. No
>
> (y luego) Implementá en money.ts lo necesario para que pasen estos tests, y vuelve a correr ng test

**Resultado:** Kiro agregó tests para NaN/Infinity en fromDecimal, fromMinor no-entero y
fuera de rango seguro, normalización de -0 (en fromMinor y en fromDecimal con -0.004), y
creó errors.spec.ts verificando que InvalidAmountError es un DomainError. Implementó la
validación en money.ts: finitud en fromDecimal, Number.isSafeInteger compartido para
rechazar no-entero/NaN/Infinity/overflow con InvalidAmountError, y normalización de -0 a
+0 en ambos constructores. `ng test` quedó en 40/40 verde, exit 0.

**Decisión:** ✅ aceptado
**Por qué:** Revisé los nuevos tests generados a partir de los casos borde que Kiro encontró y ya con esto estaría listo Money por ahora.

## #05 · transfer-policy en features/transfers/domain
**Herramienta:** Kiro

**Prompt:** (resumen) Diseño previo de availableBalance y canTransfer, destino
conocido/desconocido, tipos mínimos y orden de validaciones; luego escritura del spec,
dos rondas de ajustes al spec y la implementación final.

### Decisiones que tomé yo (elegí entre las alternativas que me propuso Kiro)
- **Forma de `canTransfer`:** elegí la Alternativa A (resultado discriminado con UNA sola
  razón: `{ allowed: true } | { allowed: false; reason }`) por sobre la Alternativa B
  (lista de violaciones), porque quiero mostrar un solo error en la UI y un mapeo
  razón -> mensaje exhaustivo.
- **Firma de `availableBalance`:** decidí que reciba `balance: Money`, `accountId` y
  `movements` sueltos, NO una entidad Account.
- **Contrato de moneda del monto:** decidí que el monto siempre viene en la moneda de la
  cuenta origen; si no, es un bug del llamador y `Money` debe lanzar CurrencyMismatchError.
  En la segunda ronda pedí que fuera determinista: validarlo PRIMERO con un chequeo
  explícito `amount.currency !== source.currency`, antes que cualquier otra validación.
- **Unificación de razones:** decidí unificar `negative-balance` dentro de
  `insufficient-funds` (saldo negativo bloquea igual).
- **Tipos mínimos:** decidí que transfers/domain declare solo los campos que la política
  necesita (accountId, direction, status, amount), sin importar nada de otras features.
- **Orden de validación:** fijé yo el orden final: same-account, non-positive-amount,
  unknown-destination-currency, cross-currency, insufficient-funds.
- **Ajustes al spec (dos rondas que dicté):** corregir el test de disponible negativo
  (contable 100000 / pendiente 150000); usar los números de 06-race-condition.txt para el
  sobregiro; agregar bordes de disponible con pendiente (10000/5000: permite 5000, bloquea
  5000.01); movimiento con direction null que no resta; disponible 0 con monto 0.01 que
  bloquea; y CurrencyMismatchError tanto en availableBalance (movimiento en otra moneda)
  como en canTransfer (incluido destino external con monto en USD).

### Lo que propuso Kiro y yo validé
- Modelar el destino como unión `own` (moneda conocida) vs `external` (otro usuario, moneda
  desconocida), con razones de bloqueo distintas (`cross-currency` vs
  `unknown-destination-currency`). Coherente con lo que ya había decidido en DECISIONS.md.
- Los casos borde A–F y H del listado inicial de Kiro.

**Resultado:** spec con 29 tests (incluye los casos de 06-race-condition.txt, bordes de
disponible con pendientes, disponible 0 con monto 0.01, y CurrencyMismatchError en
availableBalance y en canTransfer). Implementación en transfer-policy.ts solo con
shared/domain. Suite completa 69/69 verde, exit 0.

**Decisión:** ✅ aceptado con modificaciones
**Por qué:** Revisé los tests generados y los casos borde que mencionó Kiro. Una vez que el test quedó listo con las modificaciones que pedí, le solicité que implementara transfer-policy.
## #06 · Liquidación de transferencias (pending -> completed) en features/transfers/domain
**Herramienta:** Kiro

**Prompt:** (resumen) Pedí el diseño de una función pura de liquidación antes de escribir
nada (firma, tipos, dónde viven los parámetros, qué queda en domain vs application), con
mis parámetros tentativos (1000 ms, 6 intentos). Esta vez sin TDD: tests junto con la
implementación. Le pedí leer los samples 05, 11 y 12.

### Decisiones que tomé yo (elegí entre las alternativas que me propuso Kiro)
- **Contador:** `attemptsDone` (consultas ya hechas), no `attemptsLeft`.
- **Tipo del paso:** `SettlementStep` como string literal
  (`'confirmed' | 'failed' | 'retry' | 'unconfirmed'`), no un objeto, porque no lleva datos.
- **Primer GET:** después del primer intervalo, no en t=0 (el POST ya dice que está pending).
- **Config:** no la valido, es una constante nuestra (descarté el caso borde de config inválida).
- **Parámetros:** confirmé 1000 ms de intervalo y máximo 6 intentos (la API liquida en ~1,5 s).
- **Fallo de la consulta:** agregué `unknown` como estado de entrada para cuando la consulta
  falla (red/500). No es un fallo de la transferencia: se trata como `pending` (reintenta si
  quedan intentos, termina `unconfirmed` si se agotan), nunca como `failed`.
- **Casos de test:** acepté mis 4 casos núcleo (completed/failed/pending-con-intentos/
  pending-agotado) más los casos A (borde off-by-one), B (terminal gana aunque se agoten los
  intentos) y C (config de un solo intento), y pedí sumar los tests de `unknown`.

### Lo que propuso Kiro y yo validé
- Separar la decisión pura (`nextSettlementStep` en domain) del polling con timers (que irá
  en application), con `SettlementConfig` y `DEFAULT_SETTLEMENT_CONFIG` en domain.
- Que la función mire solo `transfer.status` y no dependa de `from`/`to` (el sample 12 trae
  `to: null`): ese null lo maneja el mapper de infraestructura, no la función de liquidación.

**Resultado:** `settlement.ts` y `settlement.spec.ts` escritos juntos, sin Angular. 15 tests
nuevos; suite completa 84/84 verde, exit 0. Kiro listó los casos borde que quedan fuera del
dominio (config inválida descartada, el polling con timers, el mapeo de status y el `to:null`,
todo de application/infrastructure).

**Decisión:** ✅ aceptado
**Por qué:** Revisé los casos de prueba, especialmente los límites de intentos y los errores de consulta, para asegurarme de que un problema de red no se confundiera con una transferencia fallida. Como los tests cubrieron los comportamientos esperados y la suite quedó verde, acepté la implementación.
## #07 · Mapeo central de errores de la API en shared/domain
**Herramienta:** Kiro

**Prompt:** (resumen) Pedí el diseño antes de escribir nada: una función pura que reciba
status + body + contexto de operación y devuelva un error de dominio tipado, cómo distingue
los casos sin mirar el texto del mensaje, dónde vive el catálogo de mensajes en español y
qué hace con el 401. Esta vez sin TDD: tests junto con la implementación. Le pedí leer los
samples de error 07, 08, 09, 13, 14, 15, 17, 18 y 19.

### Decisiones que tomé yo (elegí entre las alternativas que me propuso Kiro)
- **Tipo del error:** `ApiError` como objeto discriminado por `kind`, no clases.
- **404 en transferencia:** `not-found` genérico, sin un kind propio para el destino.
- **Errores por campo:** opción (b), mensaje general y resaltar los campos; nunca mostrar el
  texto crudo (inglés) de la API.
- **Catálogo de mensajes:** vive en `shared/ui` (`error-messages.ts`).
- **Alcance:** esta función solo clasifica; el interceptor y el efecto del 401 (limpiar sesión
  y redirigir) vienen en el prompt de auth.
- **Casos de test:** acepté mis 6 casos más los A–I que propuso Kiro, y agregué tres: status 0
  (sin red) da `network` (kind nuevo); 422 fuera de create-transfer da `unknown`; `{ errors: [] }`
  vacío da `unknown(400)`.
- **Clasificación sin texto:** se distingue por status + forma del body + contexto de la
  operación, nunca por el string del mensaje (el 422 solo es fondos insuficientes en
  transferencia, igual que el 400 con `{ error }` solo es misma cuenta en transferencia).

### Lo que propuso Kiro y yo validé
- Cómo se conectan el error de red y la liquidación (settlement): el tracker de application
  clasifica el fallo del GET con `mapApiError`, lo traduce a `TransferStatus = 'unknown'` y deja
  que `nextSettlementStep` decida. Un error de red al consultar nunca es un fallo de la
  transferencia. (Solo lo acordamos; no se implementó todavía.)

### Ajuste posterior (segundo prompt, sin cambiar comportamiento)
- Pedí mover `ApiError` y `mapApiError` (con sus specs) de `core/errors` a `shared/domain`,
  para que `shared/ui` dependa de `shared` y no de `core`. Y agregar un test de items
  malformados (`{ errors: [{ field: 1 }] }` da `unknown(400)`).

**Resultado:** `map-api-error.ts` + spec (en `shared/domain`) y `error-messages.ts` + spec (en
`shared/ui`), todo sin Angular. Tras el ajuste: 17 tests del mapper + 10 del catálogo; carpetas
`core/errors` y `core` quedaron vacías y se eliminaron. Suite completa 111/111 verde, exit 0.

**Decisión:** ✅ aceptado
**Por qué:** Acepté la implementación porque la clasificación quedó centralizada y contempla los distintos formatos de error sin depender de los mensajes de la API. También me pareció bien separar esa lógica de los mensajes de la UI y de los efectos del interceptor. Revisé los tests y confirmé que los casos contemplados quedaran cubiertos.
## #08 · DTOs y mappers de la API
**Herramienta:** Kiro

**Prompt:** (resumen) Pedí el diseño antes de escribir nada: los DTOs y tipos de dominio de
cuentas, transacciones y transferencias y dónde vive cada uno; los mappers DTO -> dominio con
los montos a Money; qué hacer ante un dato inválido; cómo modelar from/to en null; y la
paginación sin totalPages. Le pedí leer los samples 01, 02, 03, 04, 10, 11, 12, 20 y 21, y usar fragmentos copiados como fixtures.

### Decisiones que tomé yo (elegí entre las alternativas que me propuso Kiro)
- **Dónde viven los tipos:** las entidades que cruzan features (Account, Transaction, Page)
  van en `shared/domain`; `Transfer` queda en `features/transfers/domain` porque solo la usa
  esa feature (importa Transaction de shared). Así ninguna feature importa de otra.
- **Dato inválido:** el mapper lanza (`InvalidDataError`), no descarta el elemento, porque si
  desaparece una transacción cambia el saldo que ve el usuario. Híbrido: lanzo en lo
  monetario/estructural (amount, currency, type, status, direction, id) y normalizo lo que no
  (description a '', category a 'other').
- **from/to null:** cada lado se mapea independiente; si ambos son null, lanza.
- **createdAt:** string ISO, sin convertir a Date.
- **Coherencia type/direction:** un transfer sin dirección, o un income/expense con dirección,
  lanzan.
- **Camino de ida:** sin helper `toAmountDecimal`; pedí mappers de petición
  (dominio -> body de la API) para crear transacción y crear transferencia, con el monto en decimal.
- **Casos de test:** mis 7 casos más los A–I que propuso Kiro.

### Lo que propuso Kiro y yo validé
- La función pura `totalPages(total, pageSize)` en el dominio (la API no manda totalPages).
- Un módulo de helpers de parsing en shared para no duplicar validación entre mappers.

### Ajustes posteriores (sin cambiar comportamiento)
- Moví el DTO + mapper de la transacción a `shared/infrastructure` para que
  transfers/infrastructure no importe de transactions/infrastructure.
- Declaré `userId` en AccountDto, saqué un cast del fixture, saqué un re-export que ya no
  se usaba, y agregué un par de tests (sin pagination lanza; items malformados dan unknown(400)
  en el caso del movimiento).

**Resultado:** tipos compartidos, Transfer en su feature, DTOs/mappers (incluidos los de
petición) y 42 tests nuevos. Suite 154/154 verde, exit 0.

**Decisión:** ✅ aceptado
**Por qué:** Acepté la implementación porque los mappers separan correctamente los datos de la API de los modelos que usa la aplicación. Me pareció especialmente importante no descartar registros con datos inválidos cuando pueden afectar los saldos o movimientos del usuario. También revisé los casos de null y los tests para asegurarme de que se manejaran como esperaba.

## #09 · Consolidación del naming a "transaction"
**Herramienta:** Kiro

**Prompt:** (resumen) Noté que el DTO se llamaba TransactionDto dentro de un archivo
`movement.dto.ts`, una inconsistencia que arrastraba del rename anterior. Pedí unificar todo
bajo "transaction" y, en un segundo prompt, limpiar lo que quedaba: renombrar TransferMovement
a AccountTransaction y el parámetro movements a transactions en transfer-policy (solo rename,
sin cambiar lógica), renombrar el dto de la feature a transactions-page.dto.ts para que no se
llame igual que el de shared, sacar un re-export y tipar userId como string.

**Resultado:** renombré la entidad de dominio Movement -> Transaction y todo lo derivado
(archivo, tipos, mapper mapTransaction, constantes), AccountTransaction en la policy y sus
tests, y el dto de la feature a transactions-page.dto.ts. Una búsqueda de "movement" en
frontend/src quedó sin resultados. Suite 154/154 verde, exit 0, sin cambios de comportamiento.

**Decisión:** ✅ aceptado
**Por qué:** Hice este ajuste para mantener los nombres consistentes en todo el proyecto y evitar mezclar los conceptos de movement y transaction. Revisé que los renombres no cambiaran la lógica y que los tests siguieran pasando.
