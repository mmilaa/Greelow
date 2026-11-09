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

## #10 · Puertos y adaptadores HTTP
**Herramienta:** Kiro

**Prompt:** (resumen) Pedí el diseño antes de escribir nada: los puertos como clases abstractas en application y sus métodos; si devuelven Promise u Observable con los trade-offs; cómo falla un adaptador (HttpErrorResponse -> { status, body } -> mapApiError -> qué lanza); cómo resolver la paginación de los pendientes para el saldo disponible; y la URL base y cómo probar los adaptadores. Sin TDD: tests junto con la implementación.

### Decisiones que tomé yo (elegí entre las alternativas que me propuso Kiro)
- **Promise en todos los puertos**, no Observable: uso signals y no quiero arrastrar RxJS;
  queda confinado al adaptador.
- **Una sola familia de errores hacia application:** `ApiErrorException extends Error` con
  `.error` y `.cause`, en shared/domain junto a mapApiError. El adaptador atrapa el
  `InvalidDataError` de un cuerpo corrupto y lo relanza como kind nuevo `invalid-response`
  dejando el original en cause. Agregué ese kind y su mensaje en el catálogo de shared/ui.
- **Pendientes paginados:** pedir todas las páginas con un tope de 20; si falla cualquier
  página, lanzar sin devolver una lista parcial. La iteración vive en el adaptador; la regla
  de negocio sigue en el dominio con la lista ya completa.
- **URL base:** `API_BASE_URL` como InjectionToken en core/config.
- **Puertos:** saqué accounts.getById; dejé transfers.getById y pendingOutgoing en
  TransferPort; sin feature categories (CategoryPort va en transactions/application).
- **Casos de test:** mis 5 casos más los A–I que propuso Kiro, más dos: falla de una página
  a mitad de la paginación lanza sin lista parcial, y un 200 con cuerpo corrupto sube como
  invalid-response.

### Lo que propuso Kiro y yo validé
- Confinar RxJS al adaptador (firstValueFrom en el borde) para que application solo vea Promises.
- La excepción a "tests sin TestBed": los adaptadores son el único código que toca Angular, así
  que se prueban con HttpTestingController. Dominio y aplicación se siguen probando puros.
- Pedí además que los puertos se conecten con los adaptadores (los providers) en un solo lugar.

**Resultado:** puertos, adaptadores HTTP, `runRequest` en core, API_BASE_URL, providers y tests
con HttpTestingController. Suite 170/170 verde, exit 0.

**Decisión:** ✅ aceptado
**Por qué:** Acepté la implementación porque permite mantener la lógica de la aplicación independiente de Angular y centraliza el acceso a la API en los adaptadores. También me pareció importante resolver toda la paginación de pendientes antes de calcular el saldo disponible, para no trabajar con información incompleta.

## #11 · Ajustes a puertos y adaptadores
**Herramienta:** Kiro

**Prompt:** (resumen) Cuatro ajustes: mover dataAccessProviders a la raíz de la app para que core no importe de features; que el tope de 20 páginas en pendingOutgoing lance ApiErrorException 'invalid-response' con el motivo en cause (no un Error genérico); agregar un test del tope (total absurdo lanza y no pide más de 20 páginas); y reemplazar el helper con await Promise.resolve() por vi.waitFor en los tests de paginación.

**Resultado:** moví los providers a `app/app.providers.ts` y borré `core/providers.ts` (core
quedó con runRequest y API_BASE_URL); el tope lanza ApiErrorException 'invalid-response' con
cause; agregué el test del tope; cambié los tests de paginación a vi.waitFor. Suite 171/171
verde, exit 0, y buscar "features/" dentro de core quedó sin resultados.

**Decisión:** ✅ aceptado
**Por qué:** Acepté los ajustes porque mejoran la separación entre capas y el manejo de errores en casos límite. También se agregaron tests para verificar que el límite de páginas se respete y que core no dependa de ninguna feature.

## #12 · Autenticación y sesión (diseño, implementación y endurecimiento)
**Herramienta:** Kiro

**Prompt:** (resumen) Varias vueltas sobre la autenticación, sin pantallas, con los tests
junto a la implementación. Primero pedí el diseño (puerto de auth y sesión, interceptor,
guard y rehidratación, redirección con returnUrl, y cómo probar cada pieza). Después pedí
cuatro ajustes de seguridad y cableado, y finalmente endurecer la validación del returnUrl.

### Decisiones que tomé yo (elegí entre las alternativas que me propuso Kiro)
- **Capas:** application puede usar signals e inject, pero no el navegador, HTTP ni el Router.
- **Token:** en sessionStorage detrás de un puerto (`TokenStoragePort`) con respaldo en memoria
  si sessionStorage lanza. El store guarda el token; `login()` del puerto devuelve { token, user }.
- **Store de sesión:** máquina de estados anonymous / loading / authenticated; `expire()`
  idempotente; rehidrata con /auth/me una sola vez y no cachea ni borra el token si falla por
  algo que no sea un 401.
- **Interceptor:** solo agrega el header Authorization, y únicamente a requests del mismo
  origen que la API. La clasificación del 401 sigue en runRequest; cuando el resultado es
  unauthenticated llama a un token inyectable `ON_UNAUTHENTICATED` definido en core, que la
  raíz conecta con `session.expire()`, así core no importa nada de features.
- **Guard y rehidratación:** espera la validación en curso antes de decidir; si el token ya no
  sirve, limpia y va al login.
- **Redirección:** ruta por defecto /accounts; returnUrl por query param y solo si es interno.
- **Casos de test:** los míos más A–D, F y G, más varios de concurrencia e invalidez.

### Ajustes posteriores (sin cambiar comportamiento salvo donde se indica)
- El interceptor comparaba por `startsWith`, que dejaba pasar hosts parecidos
  (`http://localhost:3000.evil.com`): lo cambié a comparar por origen (`new URL(...).origin`),
  con tests de dominio parecido, otro puerto y otro protocolo.
- Cablée la app real en app.config.ts (provideHttpClient con el interceptor, dataAccessProviders
  y los providers de auth) y extraje `appProviders` a un arreglo exportado.
- El test de integración usa `appProviders` reales y solo reemplaza el backend HTTP, así falla
  si alguien saca el interceptor o el wiring de ON_UNAUTHENTICATED. Incluye: la request lleva el
  header, un 401 fuera de login expira la sesión, y un 401 en el login no borra un token existente.
- Reemplacé el inject repetido en cada adaptador por un servicio `ApiRequestRunner` que inyecta
  el callback una vez (resolviéndolo de forma diferida para no crear una dependencia circular,
  bug que destapó el test de integración).
- Endurecí `safeReturnUrl`: en vez del chequeo de strings, resuelve el valor con `new URL` contra
  una base inventada y lo acepta solo si el origen no cambia, cerrando los trucos con backslash y
  caracteres de control (`/\evil.com`, `/<tab>/evil.com`) que el navegador normaliza a `//evil.com`.

**Resultado:** puertos de auth, store de sesión, interceptor, guard, storage con respaldo, el
gancho en runRequest, los providers en la raíz, el ApiRequestRunner y los tests (unitarios y de
integración). Terminó en 206/206 verde, exit 0. No se hicieron pantallas ni navegación.

**Decisión:** ✅ aceptado
**Por qué:** Acepté la implementación porque separa bien el manejo de sesión del resto de la aplicación y contempla los casos de expiración y rehidratación. También me parecieron importantes los ajustes de seguridad del interceptor y del returnUrl.

## #13 · Base de la UI: rutas, shell, login y redirección de sesión
**Herramienta:** Kiro

**Prompt:** (resumen) Pedí el diseño antes de escribir nada: las rutas (login pública y
privadas con el guard, con páginas vacías para cuentas/movimientos/transferencias), el shell
con Material, el login con sus tres tipos de error, dónde vive el efecto que redirige cuando
expira la sesión, la redirección tras login, accesibilidad y cómo testear la UI sin tests
frágiles. Con Material y Reactive Forms, sin TDD, sin las pantallas de datos.

### Decisiones que tomé yo (elegí entre las alternativas que me propuso Kiro)
- **Rutas:** lazy con loadComponent; shell eager; ruta ** a /accounts; placeholders con solo un h1.
- **Shell responsive:** hamburguesa con mat-menu en pantallas chicas; logout en un mat-menu con
  el nombre del usuario.
- **Efecto de expiración:** en el App root, pero reaccionando a la TRANSICIÓN
  authenticated -> anonymous (no a cualquier anonymous, que rompería un F5 con token válido
  durante la rehidratación). Agregué al SessionStore un motivo 'expired' | 'logout': con
  expiración navega a /login con la ruta actual completa como returnUrl; con logout va a /login
  sin returnUrl. Idempotente y sin redirigir si ya está en /login. El shell y el servicio del
  efecto van en app/, no en core/.
- **Botón de login:** se deshabilita solo mientras se envía, no por form inválido, para que el
  usuario vea qué falta. Error no-ApiErrorException -> mensaje genérico y rehabilita el botón.
  autocomplete username / current-password.
- **app.spec.ts del scaffold:** lo reescribí para verificar que App monta el router-outlet.
- **Casos de test:** los míos más A–F y varios de reload/logout/returnUrl con ruta completa.

### Lo que propuso Kiro y yo validé
- El login no interpreta el kind del error: lo pasa al catálogo de shared/ui.
- Testear comportamiento observable (navegación, mensajes del catálogo, botón) y no el DOM de
  Material ni los estilos.

**Resultado:** rutas, shell, login, placeholders, el efecto de redirección y los tests. El
scaffold de app.html/app.ts quedó reducido al router-outlet. Material funciona con SCSS sin
`@angular/animations`. 222/222 verde, ng build OK.

**Decisión:** ✅ aceptado
**Por qué:** Acepté la implementación porque la estructura de rutas y el shell quedaron como esperaba, y la lógica de redirección está separada de los componentes. También revisé el manejo de errores del login y los distintos casos de sesión para evitar redirecciones incorrectas.

## #14 · Ajustes de la UI: integración de routing, guard de login y foco
**Herramienta:** Kiro

**Prompt:** (resumen) Tres cosas: un test de integración con el router real
(RouterTestingHarness, rutas reales, fakes de puertos y storage) cubriendo sin sesión, token
válido con una sola llamada a /auth/me, token inválido y logout navegando una sola vez; que si
ya hay sesión y se entra a /login redirija a /accounts, con test; y foco inicial en el email con
afterNextRender + focus() en vez de autofocus. Sin instalar dependencias.

**Resultado:** agregué el spec de integración (4 casos con router real), un `loginGuard` que
redirige a /accounts si ya hay sesión (con su ruta y test), y el foco inicial con
afterNextRender + viewChild (saqué el autofocus). Confirmé que el shell no navega en el logout
(solo lo hace el efecto), así que no había doble navegación que corregir. 227/227 verde, ng
build OK. No instalé @angular/animations.

**Decisión:** ✅ aceptado
**Por qué:** Acepté los ajustes porque mejoran la navegación y la experiencia del login. Me pareció importante probar el routing real y verificar que no hubiera llamadas o redirecciones duplicadas. También se agregó el foco inicial en el campo de email.

## #15 · Base visual: tema, tokens, componentes compartidos y accesibilidad
**Herramienta:** Kiro

**Prompt:** (resumen) Pedí el diseño antes de escribir nada: un tema de Material con mi paleta
(verificando contraste AA), los tokens como variables CSS en un solo archivo nombrados por
función, los ajustes de login y shell, los componentes compartidos de shared/ui, el formato de
dinero y cómo se haría el tema oscuro (leyendo la doc de Material de esta versión). Solo el
tema y los componentes, sin pantallas de datos. Después pedí ajustes de tokens y accesibilidad,
y correcciones de contraste en la barra.

### Decisiones que tomé yo (elegí entre las alternativas que me propuso Kiro)
- **Contraste:** le marqué que sus ratios estaban mal calculados; le pedí un script que los
  calcule ejecutando código (tools/contrast.mjs) y que leyera los valores de tokens.scss para
  no desincronizarse. Con los reales, dejé el borde de input en #7b8ca8 y acepté positivo
  #196e3c por margen sobre el chip.
- **Tokens:** en styles/tokens.scss, nombrados por función, único lugar con colores literales;
  el tema de Material se mapea a esos tokens (sobreescribí el set completo de --mat-sys-* de
  color para que no quede ningún tono por defecto). La barra tiene sus propios tokens
  (--color-bar / --color-on-bar) para no romperse en el tema oscuro.
- **Barra:** fondo #1d3156 (no el primario).
- **Íconos:** default font set a Material Symbols (la fuente que ya carga index.html), sin
  dependencias nuevas.
- **Dinero:** formatMoney con Intl es-AR y currencyDisplay "code" (ARS 1.234,56), en
  shared/domain sin Angular; los tests usan el espacio no separable (\u00a0).
- **Componentes shared/ui:** los cuatro (monto, chip de estado, estados vacío/error/carga,
  encabezado), con tests de comportamiento y no de DOM/estilos.
- **Nombre de la app:** una sola constante APP_NAME (elegí MilaPay).
- **Accesibilidad:** lang="es", título por ruta, aria-label en los botones solo-ícono, y en el
  monto tabular-nums + nowrap.

### Lo que propuso Kiro y yo validé
- Que el tema oscuro se resuelve redefiniendo los tokens bajo un selector con color-scheme, sin
  tocar componentes (leído de la doc de Material v20/22).
- Que verificara contra node_modules la lista real de tokens --mat-sys-* a sobreescribir.

### Ajustes de contraste de la barra (iterando sobre capturas)
- Al principio los links de navegación no se leían (Material no hereda el color del toolbar):
  sobreescribí los tokens de color de los botones de Material en el scope de la barra.
- Después el hover casi no se notaba y el nombre de usuario quedó invisible por tocar un token
  interno de MDC: lo resolví con un hover/focus de fondo blanco translúcido y color explícito en
  el nombre, sin pelear con los internals de Material.

**Resultado:** tema, tokens, script de contraste (todos los pares AA), íconos como Material
Symbols, formatMoney, los cuatro componentes de shared/ui, los ajustes de login y shell, y la
accesibilidad. 244/244 verde, ng build OK. Sin dependencias nuevas, sin colores fuera de
tokens.scss.

**Decisión:** ✅ aceptado con modificaciones
**Por qué:** Acepté la implementación porque la base visual quedó centralizada y consistente, y los componentes se pueden reutilizar en las distintas pantallas. También revisé el contraste con el script y fui ajustando algunos detalles visuales y de accesibilidad hasta que quedaron como esperaba.

## #16 · Refactor previo a la pantalla de cuentas (availableBalance y pendientes a shared/core)
**Herramienta:** Kiro

**Prompt:** (resumen) Antes de escribir la pantalla de cuentas, pedí resolver un problema de arquitectura: `availableBalance` y la lectura de pendientes vivían en features/transfers, y accounts no puede importar de otra feature. Pedí hacer SOLO el refactor (sin pantalla) y parar al terminar, con los tests moviéndose sin perderse.

### Decisiones que tomé yo
- Levanté la restricción de tocar transfer-policy, pero SOLO para imports y mover tests: su
  lógica, su API y los casos de canTransfer no cambian.
- `availableBalance` y `AccountTransaction` van a shared/domain; `AccountTransaction` como
  `Pick<Transaction, 'accountId' | 'direction' | 'status' | 'amount'>`. Sus tests se mueven a
  shared/domain/available-balance.spec.ts. transfer-policy importa de shared SIN re-exportar.
- `PendingTransfersPort` en shared/application, con un único `pendingOutgoing()` que trae TODOS
  los pendientes salientes del usuario sin accountId (availableBalance filtra por cuenta). Saqué
  pendingOutgoing de TransferPort.
- El adaptador va en core/data (no en shared/infrastructure): usa ApiRequestRunner y
  API_BASE_URL de core, y shared no puede depender de core. Se lleva la paginación (todas las
  páginas, tope 20, sin lista parcial si una falla). Sus tests se mueven y se ajustan a que la
  URL ya no lleva accountId.
- Lo conecté en app.providers.ts.

### Decisiones para la pantalla de cuentas (fijadas acá, para el próximo prompt)
- Pendientes primero y cuentas después, en secuencia (nada de Promise.all), para errar por
  defecto (disponible de menos) y nunca habilitar un sobregiro.
- Si fallan los pendientes o el tope: ready con pendingAvailable=false (saldo contable con
  aviso). Si falla la lista de cuentas: error. Si availableBalance lanza por dato corrupto: se
  degrada a solo contable, sin romper la pantalla.
- Refresh mantiene los datos anteriores con indicador; solo la primera carga usa loading. Fallo
  de refresh con datos presentes: se mantienen con aviso de desactualizado y reintento.
- Contador de generación para que una respuesta vieja no pise a una nueva; botón Actualizar
  deshabilitado mientras recarga. Casos A–I.

**Resultado:** refactor hecho, 244 tests (movidos, ninguno perdido), ng build OK, y el diff de
transfer-policy.ts fue solo imports (1 insertion, 28 deletions: la interface y la función que
se movieron). No se escribió la pantalla.

**Decisión:** ✅ aceptado
**Por qué:** Acepté el refactor porque permite que accounts y transfers compartan la lógica sin depender una de otra. También me pareció bien centralizar la consulta de pendientes y mantener toda la paginación en el adaptador. Revisé que se conservaran los tests y que los cambios no modificaran el comportamiento de las transferencias.

## #17 · Preparación de la pantalla de cuentas: puerto compartido, reglas de dominio y fechas estrictas
**Herramienta:** Kiro

**Prompt:** (resumen) Diseño de la pantalla de cuentas (lista, crear, detalle) pero pidiendo
hacer SOLO la preparación, sin pantallas ni stores: mover TransactionPort a shared, agregar
reglas de dominio (signo del movimiento y formato de fecha) y validar el createdAt en el
mapper. Luego dos rondas de endurecimiento de la validación de fechas.

### Decisiones que tomé yo (elegí entre las alternativas que me propuso Kiro)
- **Arquitectura:** TransactionPort, TransactionQuery y CreateTransactionInput van a
  shared/application (accounts necesita listar movimientos y no puede importar de transactions).
  El adaptador se queda en transactions/infrastructure importando el puerto de shared; CategoryPort
  queda en la feature. Sin re-exports. La raíz lo conecta.
- **mapApiError:** agregué 'create-account' al contexto; 400 con errors[] es validation, 400 con
  { error } y 422 son unknown (sin regla propia, como los demás contextos).
- **Signo del movimiento:** shared/domain/signed-amount.ts, income o direction in suma, expense o
  direction out resta, vía Money.zero().minus() sin agregar métodos a Money, sin depender del estado.
- **Formato de fecha:** shared/domain/format-date.ts, es-AR con dateStyle medium y timeStyle short,
  zona local por defecto; los tests pasan la zona explícita y normalizan los espacios.
- **Validación de createdAt en el mapper:** rechaza fechas inválidas con InvalidDataError (única
  modificación permitida a los mappers).
- **Fechas estrictas (segunda y tercera ronda):** una fecha válida es ISO 8601 con zona obligatoria
  y una fecha de calendario real validada por componentes (no por Date, que acepta el 30 de febrero
  y lo corre a marzo, y que interpreta un string sin zona en el huso local). Una sola definición
  compartida en shared/domain/iso-date.ts, de la que dependen parse.ts y format-date.ts (no entre
  sí). Corregí también unas aserciones de hora que daban falsos positivos (2:00 matcheaba 12:00).

### Lo que propuso Kiro y yo validé
- Que signedAmount y formatDateTime no existían y había que crearlas en el dominio.
- El caso de zona horaria que cambia el día (02:00Z es 4 nov 23:00 en Buenos Aires).

**Resultado:** TransactionPort movido a shared (tests conservados), signedAmount y formatDateTime
con tests, validación estricta de fechas por componentes con su módulo propio, y el mapper
rechazando createdAt inválido. Terminó en 265 tests, ng build OK. No se escribieron pantallas ni
stores. El formato es-AR usa reloj de 12 horas (a. m./p. m.), no 24h.

**Decisión:** ✅ aceptado
**Por qué:** Acepté los cambios porque permiten que accounts use los datos y reglas compartidas sin depender de otra feature. También me pareció importante centralizar el cálculo del signo y el formato de fechas, y validar estas últimas de forma estricta desde que llegan de la API.

## #18 · Lista de cuentas y crear cuenta
**Herramienta:** Kiro

**Prompt:** (resumen) Pedí el diseño antes de escribir: el store de cuentas con su máquina de
estados, la tarjeta, el diálogo de crear cuenta, el botón en el encabezado, accesibilidad y
cómo testear. El detalle quedó como placeholder. Luego varios ajustes de vista.

### Decisiones que tomé yo (elegí entre las alternativas que me propuso Kiro)
- **Store:** pendientes primero y cuentas después en secuencia (nunca Promise.all); si fallan
  los pendientes o el tope, listo con solo el saldo contable y aviso; si falla la lista,
  error; si availableBalance lanza por dato corrupto, esa fila se degrada a solo contable sin
  romper la pantalla; refresh mantiene los datos con indicador y, si falla teniendo datos, los
  conserva con aviso de desactualizado; contador de generación para que una respuesta vieja no
  pise a la nueva.
- **Dos correcciones al store que exigí:** el chequeo de generación va inmediatamente después
  de cada await y ANTES de cualquier cambio de estado, incluidas las rutas de fallo (una carga
  vieja que falla no puede pisar a una nueva que funcionó); y refreshing lo apaga solo la última
  generación.
- **Identificación de cuentas:** el id se muestra completo, atenuado, con la etiqueta "id de
  cuenta" en una esquina de la tarjeta, fuera del enlace del nombre, con overflow-wrap anywhere.
  Permití nombres repetidos (documentado en DECISIONS).
- **Tarjeta clicable:** patrón de enlace extendido, el link envuelve solo el nombre y un ::after
  hace clicable toda la tarjeta, para que el nombre accesible sea corto.
- **Crear cuenta:** MatDialog, formulario reactivo con validator trimmedLength(2,100) sobre el
  valor recortado (solo espacios no es válido) y moneda sin valor por defecto con aviso de que
  no se puede cambiar. Errores con el catálogo, nunca el texto de la API. Si falla el create, el
  diálogo queda abierto con el error.
- **Botón "Nueva cuenta":** en el encabezado, nunca deshabilitado (un botón que se deshabilita
  con el foco puesto lo pierde); el foco vuelve a él al cerrar el diálogo. Actualizar y el submit
  usan la opción de Material para seguir enfocables estando deshabilitados (disabledInteractive,
  verificado en el paquete instalado). Tras crear: snackbar anunciado; si la recarga falla,
  mensaje específico.
- **Estado vacío:** solo un mensaje que apunta al botón del encabezado, sin segundo botón que se
  destruiría al crear la primera cuenta.

### Ajustes de vista posteriores
- En el diálogo, los campos nombre y moneda quedaban lado a lado: los apilé (nombre arriba,
  moneda debajo) y separé un poco más para que el label "Nombre" no se corte.
- Reemplacé el botón de texto "Actualizar" por un botón con el ícono refresh, pero con forma de
  botón (contorno), con aria-label y tooltip.

**Resultado:** store, tarjeta, diálogo, página de lista y request mapper, con /accounts/:id como
placeholder. De 265 a 292 tests. ng build OK. Casos borde señalados sin cubrir: el retorno del
foco del diálogo y disabledInteractive quedaron sin test automatizado (comportamiento de Material
sobre overlay, frágil en unit), verificables a mano.

**Decisión:** ✅ aceptado con modificaciones
**Por qué:** Acepté la implementación porque el store contempla los distintos estados de carga y evita que una respuesta vieja sobrescriba datos más recientes. También revisé los detalles de la tarjeta y del diálogo para que la creación de cuentas sea clara y accesible, incluyendo cómo se muestran los errores y se recupera el foco al cerrar.

## #19 · Detalle de cuenta
**Herramienta:** Kiro

**Prompt:** (resumen) Diseño e implementación del detalle de /accounts/:id: tarjeta de la cuenta,
acción Transferir, últimos 5 movimientos, estados por sección, navegación entre cuentas sin
pisar datos, título de pestaña dinámico. Luego varias rondas de corrección: un loop infinito al
entrar al detalle, el diagnóstico real del error de TestBed, y el ajuste de los tests de
integración.

### Decisiones que tomé yo (elegí entre las alternativas que me propuso Kiro)
- **Reuso de la tarjeta:** AccountSummaryComponent presentacional (moneda, saldo, disponible,
  aviso); el id y el nombre los pone cada contenedor (lista: enlace; detalle: h1).
- **Store del detalle:** provisto en el componente, con reset síncrono al cambiar el id; expone
  un computed de la vista de la cuenta (cargando/error/no-encontrada/encontrada) combinando el
  estado del AccountsStore con el id, para poder probarlo sin DOM.
- **Carga al entrar:** una sola operación sobre la lista (si no hay datos, cargar; si los hay,
  refrescar), nunca las dos. Test: una navegación hace un pedido de pendientes y uno de cuentas;
  al cambiar de cuenta, exactamente dos de cada uno (carga inicial + refresco), para que una
  carga doble no pase.
- **Catálogo:** transactionTypeLabel(type, direction) y categoryLabel en shared/ui con switch
  exhaustivo; una categoría desconocida se muestra cruda con la primera letra en mayúscula; en
  las transferencias la categoría "transfer" no se repite.
- **Movimientos pending/failed:** atenuados con el token de texto suave (no opacity, que bajaría
  el contraste), con el chip de estado.
- **Título de pestaña:** solo el nombre de la cuenta (y "Cuenta" hasta que resuelve); la ruta no
  lleva title estático.
- **Botón volver:** un botón "Volver a cuentas" siempre visible en el detalle.

### El loop infinito (diagnóstico con evidencia, no suposición)
- En una primera vuelta atribuí un crash de tests a un ciclo de imports sin comprobarlo; me
  hiciste diagnosticarlo. madge confirmó que NO había ciclo. Eran DOS problemas distintos: un
  artefacto de correr vitest directo (sin el compilador de Angular, que ng test sí carga) y un
  loop infinito real.
- La causa del loop: un effect que reaccionaba al id de la ruta llamaba setAccountId, que lee y
  escribe las señales del store (refresh/ensureLoaded); el effect quedaba suscrito a esas señales
  y se re-ejecutaba sin fin (peticiones infinitas en el navegador, memoria agotada en los tests).
  Lo arreglé envolviendo la llamada en untracked, para que el effect dependa solo del id.
- Pedí que un loop falle rápido: el test de integración usa fakes que cuentan llamadas y lanzan
  si se superan, con los stores reales y el router real.

**Resultado:** store del detalle, resumen reusable, fila de movimiento, página con sus estados,
helpers de etiquetas, botón volver, y tests (incluido el de integración que blinda el loop).
336 tests, ng build OK. Correr siempre con ng test, nunca vitest directo.

**Decisión:** ✅ aceptado
**Por qué:** Acepté la implementación porque pude reutilizar la tarjeta de cuenta y mantener separados los estados de la cuenta y sus movimientos. También me pareció importante resolver el loop del effect con evidencia y dejar un test de integración que detecte si vuelven a dispararse llamadas de más.

## #20 · Refactor previo a movimientos: puerto, store y fila de transacción a shared
**Herramienta:** Kiro

**Prompt:** (resumen) Antes de la pantalla de movimientos, pedí resolver un problema de
arquitectura con refactors sin comportamiento nuevo: movimientos necesita la lista de cuentas
(selector y nombre por fila), transfers la va a necesitar con el disponible, y la fila de
transacción vivía en accounts/ui, pero las features no se importan entre sí. Luego un ajuste
chico para renombrar también las descripciones de tests.

### Lo que pedí (refactors puros, 336 tests que se mueven y no se pierden)
- Mover `AccountPort` y `CreateAccountInput` a shared/application; el adaptador se queda en
  accounts/infrastructure y la raíz lo conecta, como con TransactionPort.
- Mover `AccountsStore` y `AccountRow` a shared/application, con sus specs y sin cambiar su
  comportamiento (ensureLoaded, el contador de generación, inFlight). Las páginas, el diálogo y
  el store del detalle de accounts importan de shared.
- Mover la fila de transacción a shared/ui y renombrarla de `MovementRowComponent` a
  `TransactionRowComponent` (selector app-transaction-row, input movement -> transaction, clases
  CSS movement__* -> transaction__*). Imports y specs actualizados.
- Renombrar los identificadores que quedaban con "movement" a "transaction" (en el store del
  detalle: MovementsState -> TransactionsState, movements -> transactionsState, retryMovements ->
  retryTransactions, loadMovements -> loadTransactions, y sus consumidores en la página de
  detalle). Los textos de interfaz en español no cambian.
- Sin dependencias nuevas, sin tocar transfer-policy ni los mappers, sin re-exports.

### Decisiones que tomé yo
- `AccountRow` se mueve junto con `AccountsStore` porque está declarado en el mismo archivo y es
  su tipo de salida.
- Renombré también las clases CSS `movement__*` / `detail__movements*` a `transaction__*` /
  `detail__transactions*` para mantener coherencia de vocabulario, ya que el scss se movía igual.
- `account-detail.store` se queda en accounts/ (solo se movieron el puerto, el store compartido y
  la fila; el store del detalle solo cambió imports y los identificadores internos).
- Segundo ajuste: renombré las descripciones (describe e it) de los specs que usaban "movement"
  o "movements" como sustantivo a "transaction" / "transactions", para que buscar "movement" en
  el código no devuelva nada salvo los textos de interfaz en español ("movimientos"). No cambié
  ninguna aserción.

**Resultado:** puerto, store y fila movidos a shared con sus specs; identificadores y
descripciones de tests renombrados a transaction; imports actualizados en todos los consumidores
(páginas, diálogo, componentes, adaptador, app.providers y tests de integración). Buscar
"movement" en frontend/src ya no devuelve nada; solo quedan los textos de UI en español. 336
tests (movidos, ninguno perdido), ng build OK. No se escribieron pantallas.

**Decisión:** ✅ aceptado
**Por qué:** Acepté el refactor porque permite que las distintas features compartan cuentas y transacciones sin depender unas de otras. También aproveché para unificar los nombres en el código y mantener la misma terminología en archivos, componentes, estilos y tests, sin cambiar el comportamiento existente.

## #21 · Pantalla de movimientos (solo lectura)
**Herramienta:** Kiro

**Prompt:** (resumen) Diseño e implementación de la pantalla de movimientos (/transactions), solo
lectura: título, zona de filtros, listado y paginador; filtros en la URL; estados de carga,
error, vacío (con y sin filtros) y listo; accesibilidad. El alta de ingreso/gasto y las
transferencias quedan para después. Pedí leer antes el steering y los samples 27 a 34, y parar si
el 31 (page fuera de rango) o el 29 (búsqueda) contradecían mis supuestos. Después, un botón "Ver
todos" en el detalle, un ajuste del botón Actualizar y una discusión sobre filtros multi-opción.

### Verificación de supuestos contra los samples (no contradecían, así que escribí)
- 31 (`?page=99`, total 13): la API devuelve lista vacía con el total real y eco del page pedido.
  Confirma: el cliente corrige yendo a la última página con replaceUrl; con total 0, vacío en
  page 1.
- 29 (búsqueda con otra capitalización): mismos resultados que el 28. Confirma búsqueda por
  substring de description, case-insensitive del lado del servidor; el cliente solo recorta.
- 27 combo de filtros, 30 vacío real, 32 pageSize>50 capado a 50, 33 type inválido -> 0, 34
  page=0 -> page 1. Todos consistentes; igual en el cliente ignoro los inválidos antes de llamar.

### Decisiones que tomé yo (elegí entre las alternativas que me propuso Kiro)
- **Filtros en la URL como fuente de verdad**, con funciones puras de dominio
  (`parseFilter`/`writeFilter`) en features/transactions/domain. La conversión de página entre el
  paginador (base 0) y la API (base 1) va en shared/domain/page.ts (`toApiPage`/`toUiPageIndex`).
- **Validación diferida:** account y category no se descartan como inválidos mientras su lista no
  cargó (lista `null` = "todavía no sé"); recién cuando la lista está cargada y el valor no está,
  se descarta con aviso. Un account en la URL antes de que cargue la lista dispara la consulta de
  inmediato; si luego no existe, se descarta y se hace UNA consulta más sin él.
- **Cuentas por ensureLoaded** del AccountsStore (sin refrescar en cada cambio de filtro); la
  consulta de movimientos no espera a las cuentas. Si fallan, la pantalla funciona y la cuenta se
  muestra por su ID.
- **Categorías caídas:** la category de la URL igual se manda a la API, con el select
  deshabilitado y un aviso; el resto de los filtros sigue funcionando.
- **Dedup solo contra la última consulta EXITOSA** (sin relación con el historial); una que falló
  se reintenta; Actualizar fuerza. Contador de generación chequeado tras cada await y antes de
  tocar estado, también en los fallos. Mientras carga una consulta nueva no se ven filas de la
  anterior.
- **Debounce de búsqueda (300 ms) en el componente de filtros**, con tres cuidados: se cancela al
  destruir el componente, la URL se arma con el filtro actual al emitir (escribir y cambiar otro
  filtro dentro de la ventana conserva ambos), y el texto del buscador vuelve al de la URL con
  "atrás". La búsqueda navega con replaceUrl (no agrega historial); los demás filtros navegan
  normal, así "atrás" vuelve al filtro anterior.
- **Página fuera de rango:** ir a la última con replaceUrl; total 0 -> vacío en page 1.
- **Filas:** reuso TransactionRow; en "Todas las cuentas" cada fila muestra además el nombre de la
  cuenta y su ID atenuado (un wrapper en la página, sin tocar la fila compartida); con una cuenta
  elegida no se repite; si el accountId no está en la lista, solo el ID.
- **Paginador:** mat-paginator con 10/25/50, total visible, textos en español vía un
  MatPaginatorIntl provisto en la página.
- **Accesibilidad:** labels en todos los controles, región aria-live que anuncia la cantidad
  después de cada consulta (no por tecla), foco al primer control tras Limpiar filtros, título de
  pestaña.

### El botón "Ver todos" y el ajuste del Actualizar
- Agregué en el detalle de cuenta un botón "Ver todos" al lado de "Últimos movimientos" que lleva
  a /transactions?account=<id> (lo pedí primero como mat-button y después como botón con
  contorno).
- El botón Actualizar de los filtros (solo ícono) mostraba espacio al costado del ícono porque
  mat-stroked-button reserva padding de texto; lo dejé cuadrado y centrado por CSS, manteniendo
  el contorno.

### Diagnósticos durante el trabajo (con evidencia, no suposición)
- routing-integration rompió porque la página inyecta CategoryStore y faltaba el CategoryPort en
  ese test; agregué el fake.
- La página fuera de rango no corregía: una página vacía con total>0 iba al estado "empty", y la
  corrección solo miraba "ready". Hice que "empty" lleve el eco de paginación y la corrección
  cubra ambos.
- acc-9999 hacía una sola consulta: los effects corren diferidos tras el primer CD y para entonces
  ensureLoaded ya había resuelto. Disparé la primera consulta síncrona en el constructor con el
  filtro de la URL tal cual; la segunda la dispara el effect cuando la lista invalida la cuenta.

### Filtros multi-opción: lo discutimos y NO se hizo
Pediste filtros de opción múltiple (varias cuentas, "ingresos y gastos sin transferencias", etc.).
Expliqué que el endpoint filtra por un valor único por campo y devuelve la paginación ya filtrada
por el servidor; el multi-valor obligaría a filtrar en el cliente (rompe el total) o a varias
llamadas con merge (paginación aproximada). Decidiste dejar los filtros como están. Quedó
registrado en DECISIONS #26.

**Resultado:** dominio del filtro, store de movimientos con generación/dedup, store de categorías
idempotente, página con URL<->filtro y corrección de fuera de rango e inválidos, componente de
filtros con debounce, paginador en español, botón "Ver todos", ajuste del Actualizar. De 336 a
399 tests (incluido un test de integración con router y stores reales que acota las consultas por
caso), ng build OK. No se tocó lógica de negocio en los componentes ni se importó entre features;
sin dependencias nuevas.

**Decisión:** ✅ aceptado
**Por qué:** Acepté la implementación porque los filtros quedan sincronizados con la URL y la paginación sigue dependiendo de la API, sin perder consistencia.

## #22 · Registrar ingreso y gasto (alta de transacción)
**Herramienta:** Kiro

**Prompt:** (resumen) Implementar el alta de ingreso/gasto. Empezó como pantalla
/transactions/new y después pedí pasarla a diálogo (MatDialog) abierto desde el detalle de la
cuenta, reusando todo el dominio y el store. Siguieron varias rondas de ajuste: peso del bundle,
guards de doble clic, fixes de UI del diálogo y el error de validación del monto. Pedí leer antes
los samples 10, 20 y 37 a 41.

### Verificación de supuestos contra los samples (no contradecían, así que escribí)
- 37 (gasto mayor al saldo): la API lo acepta y deja la cuenta en negativo -> aviso no bloqueante
  con leavesNegative.
- 38 y 39 (400): mismo formato { errors: [{ field, message }] } -> validation, sin kind nuevo;
  resalto los controles que marca la API (category, description).
- 40 (12.345): la API guarda 3 decimales; el formulario permite 2 y lo de la API se redondea al
  centavo (test de caracterización en el spec del mapper, sin tocar el mapper).
- 41 (ingreso con categoría transfer): la API lo acepta -> categoriesFor es regla del cliente; la
  fila se muestra sin romper.

### Decisiones que tomé yo (elegí entre las alternativas que me propuso Kiro)
- **Dominio puro con tests:** parseAmountInput (centavos con enteros, nunca float; too-large con
  try/catch solo de InvalidAmountError; "-" inicial -> not-positive), categoriesFor(type, catalog)
  intersectando el catálogo real con orden alfabético en español y "Otros" al final, y
  leavesNegative(type, available, amount) (ingreso siempre false; disponible desconocido no avisa).
- **Mensajes en el catálogo de shared/ui:** el de resultado incierto (network/invalid-response)
  parametrizado por sustantivo (movimiento/transferencia) para reusarlo en transferencias; el de
  too-many-decimals menciona el punto de miles con ejemplo.
- **De pantalla a diálogo:** la cuenta y el tipo ya vienen decididos al abrir (botones del detalle
  "Registrar ingreso"/"Registrar gasto"); el diálogo no tiene selector de cuenta ni de tipo.
  Eliminé la página, su ruta, el manejo de parámetros de la URL y los estados sin-cuentas/lista-falla.
- **Desacople sin importar entre features:** clase abstracta NewTransactionLauncher en shared;
  implementación en transactions ligada en la raíz (ver DECISIONS #27).
- **Reload del detalle tras crear:** el store del detalle ganó reload() (refresca cuentas y
  re-pide los 5 movimientos con el contador de generación). Cerrar sin crear no recarga.
- **No se puede cerrar mientras envía** (Escape, backdrop y botón), para que el resultado no quede
  sin verse.

### Bundle inicial (varias vueltas)
Ligar la implementación directa del launcher en la raíz metía MatDialog en el bundle inicial
(subió a ~532 kB). Lo resolví con un launcher liviano en la raíz (sin importar Material ni el
diálogo) que hace import() dinámico de la implementación al primer open: el inicial volvió a ~503
kB y MatDialog quedó en el chunk lazy del diálogo. El launcher es de un solo vuelo y, si el chunk
no carga, el detalle muestra un aviso para reintentar.

### disabledInteractive no frena el clic en <button>
En Material 22.2.5, disabledInteractive solo cancela el clic en anclas, no en botones: el
manejador se ejecuta igual. Audité todos los usos: agregué un guard propio (if (…) return) en
Actualizar de cuentas, en Registrar ingreso/gasto del detalle y en Actualizar de los filtros; los
dos diálogos ya se protegían en su submit/store. Cada guard con su test de "un clic deshabilitado
no hace nada".

### El error del monto no aparecía (diagnóstico)
"11." y "11-" no mostraban error ni dejaban enviar, pero tampoco avisaban. La causa: la validación
del monto vivía en una señal aparte y el FormControl "amount" no tenía ningún validador, así que
el <mat-error> (que depende de que el control sea inválido y esté tocado) nunca se activaba. Lo
arreglé con una ValidatorFn sobre el control que delega en parseAmountInput y expone el motivo
como error de Angular; el <mat-error> lee el mensaje del catálogo. Tests sobre el DOM: "11." y
"11.22,33,222,333," marcan error tras blur; "11,5" y "11.25" no; enviar vacío o inválido muestra
el error, no llama a create y deja el foco en el monto.

### Ajustes de vista del diálogo
La vista previa "Vas a registrar…" quedó abajo, antes de los botones, junto al aviso de saldo
negativo; corregí el espaciado entre campos (hints que chocaban con los labels) quitando el
subscriptSizing dinámico para que todos reserven su franja, y separé un poco más el campo del
monto de categoría y descripción.

**Resultado:** dominio (parseAmountInput, categoriesFor, leavesNegative) con tests; store de alta
idempotente; diálogo con validación real del monto, vista previa, aviso de negativo, resultado
incierto con link, resaltado de campos en 400 y bloqueo de cierre al enviar; launcher abstracto en
shared + launcher liviano con carga diferida en la raíz; reload() del detalle; botones del detalle
con guard de doble clic; test de la impl real con MatDialog falso y test de integración con stores
reales. Terminó en 487 tests, ng build OK, bundle inicial ~503 kB. No se tocó transfer-policy ni
los mappers (salvo el test de caracterización) y no se importó entre features.

**Decisión:** ✅ aceptado con modificaciones
**Por qué:** Acepté la implementación con algunos ajustes porque pude mantener el alta desacoplada de accounts y evitar que el diálogo aumentara el bundle inicial. También revisé la validación del monto y los casos de doble clic, errores y cierre durante el envío, para asegurarme de que el usuario siempre reciba una respuesta clara.

## #23 · Lógica de transferencias (store y tracker, sin pantalla)
**Herramienta:** Kiro

**Prompt:** (resumen) Diseño e implementación de la lógica de transferencias SIN pantalla
(la pantalla queda para después), reusando lo que ya existe: transfer-policy (canTransfer,
availableBalance), settlement (nextSettlementStep, DEFAULT_SETTLEMENT_CONFIG), TransferPort,
PendingTransfersPort, AccountPort, AccountsStore, toCreateTransferBody,
mapApiError('create-transfer'), uncertainResultMessage y parseAmountInput. Pocas piezas: un
TransferStore y un tracker, sin capas extra, sin RxJS. Pedí leer antes el steering y los samples
04, 05, 06, 08, 11 a 15 y 43 a 46, y proponer sin escribir código. Después vinieron las
respuestas a las decisiones (con dos correcciones mías), cuatro verificaciones puntuales y el
cierre.

### Decisiones que tomé yo (elegí entre las alternativas que me propuso Kiro)
- **Dos piezas, no más:** TransferStore (features/transfers/application) con la máquina de
  estados (idle con lastError tipado, validating, blocked con reason+available, submitting,
  tracking con attempt, confirmed, failed, unconfirmed, uncertain con kind/verifying/
  verification) y TransferTracker (los timers con setTimeout, no setInterval). El catálogo de
  textos va en features/transfers/ui (no en shared/ui): TransferBlockReason es de la feature y
  shared no importa features; en shared/ui quedan solo los reutilizables (uncertainResultMessage
  con el sustantivo, errorMessage, formatMoney).
- **Una sola acción pública submit(request):** guard síncrono (si no está idle, vuelve), luego
  validating, lectura fresca, canTransfer, submitting y create. Sin validate()/submit() separados.
- **Lectura fresca sin duplicar el AccountsStore:** reuso AccountsStore.refresh() (pendientes
  primero, cuentas después, en secuencia) y expongo desde ese store, en el estado ready, el array
  crudo de pendientes de la MISMA lectura, junto con pendingAvailable. Único cambio permitido al
  AccountsStore, con sus tests. Así canTransfer sigue siendo la única autoridad de fondos y el
  disponible de la tarjeta y el de la validación salen de la misma lectura. Si tras refresh el
  estado quedó en error/stale, o pendingAvailable es false, o la fila no está o su available es
  null, bloqueo con 'available-unknown' (no transfiere, hay mensaje y reintento).
- **Monto ya parseado:** el store recibe Money (el formulario lo valida con su ValidatorFn, como
  el diálogo de alta); no parsea texto ni tiene bloqueo de formato.
- **Errores conocidos al crear (400/404/422/401):** vuelve a idle con lastError TIPADO (el
  ApiError), no texto en español; el texto lo arma la UI con el catálogo. El 401 no es incierto
  (el servidor lo rechazó): sin seguimiento ni reintento, la sesión expira y redirige sola.
- **Seguimiento:** el primer GET /transfers/:id va después del primer intervalo (el POST ya dice
  pending); cada consulta alimenta nextSettlementStep; un error de consulta (red/5xx/invalid) es
  'unknown' (no falla la transferencia); un unauthenticated corta. Los timers viven en el tracker
  y se prueban con vi.useFakeTimers(); se cancelan al destruir la pantalla (DestroyRef). Agotados
  los 6 intentos queda 'unconfirmed' con "Verificar de nuevo", que corre UNA consulta inmediata
  (no un ciclo nuevo), con guard contra clics repetidos.
- **Refresco del AccountsStore una vez** al llegar a confirmed o failed (en failed la pendiente
  desaparece y cambia el disponible); en unconfirmed no.
- **Bloqueo por cuenta de origen:** una transferencia en seguimiento desde A bloquea nuevos
  envíos desde A, no desde B (una señal por cuenta en el store).
- **Resultado de crear que no se conoce:** (a) error de red (puede haberse creado o no) ->
  uncertain, lectura de verificación y recién al terminar se habilita "Intentar de nuevo", aun si
  la verificación falló (con aviso); (b) 2xx con cuerpo ilegible (invalid-response) -> el servidor
  la aceptó, así que reintentar duplicaría: NO se ofrece "Intentar de nuevo", solo "Ver cuenta" y
  "Hacer otra transferencia". La verificación lee los pendientes (filtrados por la cuenta de origen
  en el cliente, porque pendingOutgoing no recibe accountId) y las últimas 5 transferencias
  (TransactionPort.list type transfer, filtrando direction 'out'); se muestra la lista, sin buscar
  coincidencias automáticas.
- **Dos correcciones mías al plan inicial:** que invalid-response no ofrezca reintento (lo de
  arriba) y que el catálogo de textos viva en la feature y no en shared.

### La verificación del conteo (prompt aparte)
Noté que mi resumen de tests no cerraba. Lo verifiqué con el reporter JSON del runner, con
git stash -u para el "antes": los specs de transfers no existían (0) y accounts.store.spec pasó
de 23 a 26. Mi resumen previo decía "transfer-messages 8" cuando eran 6: error al escribir el
resumen, no en el código.

### La lectura fresca pisada (hallazgo del punto 2, con evidencia)
Al revisar, encontré un agujero real: AccountsStore tiene un contador de generación y, cuando una
corrida es pisada por otra más nueva, su await termina pero NO toca el estado, dejando los datos
viejos hasta que la nueva termina; submit los leería como frescos. Lo corregí con un cambio
mínimo en AccountsStore: una señal dataGeneration que solo avanza cuando la corrida de esa
generación escribe el estado. submit captura dataGeneration() antes del refresh y exige que avance;
si fue pisada reintenta la lectura una vez, y si sigue sin aplicarse bloquea con 'available-unknown'.
Nunca valida con datos anteriores a su lectura. Con promesas controladas: una lectura pisada no se
usa para validar.

### Verificación de la verificación (punto 3) y archivos huérfanos (punto 4)
Confirmé por nombre de test: (a) outgoingPending filtrado por la cuenta de origen; (b)
recentOutgoing solo direction out; (c) si falla la lectura de PENDIENTES (no solo la de
transacciones) readFailed es true y la salida se habilita igual; (d) cancelar durante la
verificación no la resucita; (e) una confirmación en "Verificar de nuevo" refresca el AccountsStore
una vez. Lo que faltaba lo agregué. git status confirmó que no quedó ningún archivo sin usar (no
existe transfer-outcome.ts); los nuevos son las 3 piezas de código y sus 3 specs.

**Resultado:** TransferStore + TransferTracker + el catálogo de textos de la feature; único cambio
al AccountsStore (la señal dataGeneration y el array pendings en ready), con sus tests. De 487 a
535 tests (transfer.store 26, transfer-tracker 12, transfer-integration 1, transfer-messages 6, y
+3 en accounts.store.spec: pendings y la generación pisada), ng build OK. transfers.page.ts sigue
como placeholder. No se tocó transfer-policy ni settlement, sin dependencias nuevas ni imports
entre features.

**Decisión:** ✅ aceptado con modificaciones
**Por qué:** Acepté la implementación con modificaciones porque pude reutilizar la lógica de dominio y el store de cuentas sin duplicar responsabilidades. Me pareció especialmente importante corregir el problema de las lecturas pisadas, para asegurarme de que una transferencia nunca se valide con un saldo desactualizado. También revisé los casos de error, seguimiento y reintento para evitar transferencias duplicadas.

## #24 · Pantalla de transferencias (/transfers)
**Herramienta:** Kiro

**Prompt:** (resumen) Diseño e implementación de la pantalla /transfers usando el TransferStore y
el TransferTracker del #23, reemplazando el placeholder transfers.page.ts. Sin TDD: los tests
junto con la implementación. Sin tocar la lógica de application ni la política. Pedí proponer sin
escribir código; después respondí las decisiones (con ajustes) y di luz verde.

### Decisiones que tomé yo (elegí entre las alternativas que me propuso Kiro)
- **Tres piezas, presentacionales:** la página (contenedor) provee TransferStore y
  TransferTracker a nivel de componente (no en root) y cancela los timers con DestroyRef; un
  formulario presentacional (Reactive Forms) y un panel de estado presentacional. Más una función
  de dominio con tests para los destinos elegibles (eligibleDestinations), ya que canTransfer es
  la validación final. Los componentes solo muestran y emiten; la lógica vive en el store/dominio.
- **El formulario NO se reemplaza ni se destruye:** queda renderizado y deshabilitado
  (form.disable con emitEvent false) mientras el estado es submitting, tracking o terminal, con el
  panel debajo. Razón: si se destruye con un @if, pierde su FormGroup y "Intentar de nuevo" (red)
  devolvería un formulario vacío; además el usuario ve qué está enviando. Se rehabilita en idle y
  blocked.
- **blocked deja el formulario editable:** cualquier cambio estando en blocked, o con un lastError
  visible, limpia ese mensaje (store.reset()), para que no quede un motivo viejo.
- **Destino:** las cuentas de otra moneda y la de origen aparecen deshabilitadas con el motivo en
  la opción; además, como mat-select saltea las deshabilitadas con el teclado, una mat-hint bajo
  el destino lista las no disponibles con su motivo ("No disponibles: Cuenta X (moneda distinta)").
  Sin origen, el destino está deshabilitado con la ayuda "Elegí primero la cuenta de origen".
  Nunca se preselecciona; cambiar el origen limpia un destino que dejó de ser válido y recalcula
  la moneda del monto. Sin ningún destino válido: mensaje con link a /accounts.
- **Origen:** preseleccionado desde ?from= (validado contra las cuentas: no se descarta antes de
  que cargue la lista, y si no existe se ignora). Debajo, "Disponible: ARS 849.000,00" de la fila
  del AccountsStore; si no se pudo calcular, el texto de available-unknown y un botón Reintentar.
- **Monto:** igual que el diálogo de alta (ValidatorFn con parseAmountInput y la moneda del
  origen, vista previa, error al salir del campo o al enviar); se recalcula al cambiar el origen.
- **Panel uncertain:** recentOutgoing con TransactionRow y, si hay outgoingPending, una
  línea-resumen "Tenés N transferencia(s) en proceso desde esta cuenta". En red, "Intentar de
  nuevo" solo cuando verifying es false; en invalid-response, sin "Intentar de nuevo".
- **Terminales:** "Hacer otra transferencia" vuelve el store a idle y limpia monto y descripción
  (mantiene origen y destino) y pone el foco en el monto; "Ver cuenta" navega a /accounts/<id>. Al
  salir de la pantalla durante el seguimiento se cortan los timers (DestroyRef -> store.destroy()).
- **Título solo en la ruta (title: 'Transferir'):** sin usar el servicio Title en el componente.
  Actualicé el test de títulos que esperaba 'Transferencias' para /transfers. La etiqueta de la
  barra del shell sigue diciendo "Transferencias".
- **Accesibilidad y layout:** un h1, panel de progreso en role="status" aria-live polite, errores
  con role="alert", foco al encabezado del resultado en cada terminal; una sola columna, gap
  --space-3, subscriptSizing dynamic y sin colores fuera de tokens.

### Ajuste de un test preexistente (cambio legítimo, avisado)
- routing-integration.spec.ts: la aserción del título de /transfers pasó de 'Transferencias' a
  'Transferir'; y agregué un TransferPort falso a sus providers, porque la página ahora provee
  TransferStore/TransferTracker, que lo inyectan al navegar a /transfers.

### Diagnóstico durante los tests (con evidencia)
- El spec de la página fallaba con "Cannot match any routes": los tests no llamaban a setup()
  (nunca se configuraba provideRouter). Lo moví al beforeEach. Y como TransferStore se provee a
  nivel de componente, lo obtengo por el injector del routeDebugElement, no por TestBed.inject.
- focusAmount reventaba en los tests con un nativeElement indefinido: lo hice null-safe.

### Fix posterior: el adaptador no desenvolvía el envelope de la API
Al probar la pantalla, TODAS las transferencias terminaban en "el servidor aceptó la transferencia
pero no pudimos leer su identificador" (invalid-response). Reporté que el mapper parecía devolver
error ante un 200 y que, como en transactions (`{ transaction: {...} }`), transfers debía
desenvolver `{ transfer: {...} }`.

- **Causa raíz (confirmada leyendo el código):** el adaptador le pasaba el cuerpo entero
  (`{ transfer: {...} }`) a mapTransfer, que espera id/status/from/to en el nivel superior. Al leer
  dto.from/dto.to sobre el envelope, ambos daban undefined -> el mapper lanzaba InvalidDataError ->
  runRequest lo clasificaba como invalid-response. Por eso el POST y cada GET del seguimiento caían
  en ese estado. El de transactions ya desenvolvía raw.transaction; a transfers le faltaba el
  raw.transfer equivalente. Y el test del adaptador flusheaba el cuerpo SIN envolver (el shape que
  el mapper esperaba), así que pasaba y tapaba el bug.
- **Qué cambié:** transfer-http.adapter.ts: create y getById desenvuelven raw.transfer antes de
  mapear (tipo TransferEnvelope), igual que transactions con raw.transaction (evidencia: samples 11,
  12, 43, 44, 45). transfer-http.adapter.spec.ts: corregí los dos tests para que flusheen el cuerpo
  ENVUELTO como responde la API real (era un test equivocado) y agregué uno que fija el contrato: un
  2xx SIN envelope da invalid-response, no un éxito silencioso ni un crash. transfer.dto.ts:
  endurecí mapTransfer para que un DTO ausente o no-objeto lance InvalidDataError (dato inválido) en
  vez de un TypeError crudo que escaparía sin clasificar (lo descubrió el test nuevo del envelope).

**Resultado:** transfers.page + transfer-form + transfer-status-panel + la función de dominio
transfer-destinations, todo con tests de comportamiento, un test de integración con router y
stores reales y puertos que cuentan y lanzan a la 12ª (conteos create 1, getById 2, cuentas 3,
pendientes 3) y un test de que salir durante el seguimiento no deja timers. El fix del envelope
devolvió el seguimiento a confirmar en vez de quedar siempre incierto. De 535 a 583 tests (47 de
la pantalla + 1 del envelope), ng build OK (el warning de budget es previo). Sin dependencias
nuevas, sin tocar application ni la política, sin imports entre features.

**Decisión:** ✅ aceptado con modificaciones
**Por qué:** Acepté la implementación con modificaciones porque la pantalla reutiliza la lógica del store y mantiene los componentes presentacionales. También revisé los estados del formulario, los destinos no disponibles y los casos de reintento. Durante las pruebas encontramos un problema real en el adaptador: no estaba desenvolviendo la respuesta de la API. Corregí el mapeo y los tests para que reflejaran el formato real de la respuesta.

## #25 · Pantalla de gastos (resumen por categoría, con separación por cuenta)
**Herramienta:** Kiro

**Prompt:** (resumen) Agregar una pantalla "Gastos": un resumen de gastos por categoría, en una
pestaña nueva de la barra a la derecha de "Transferencias". Implementarla directa (sin propuesta
previa) y con pocas piezas, reusando lo existente (TransactionPort, Money, formatMoney,
MoneyAmount, categoryLabel, StatePanel, tokens de color). Sin dependencias nuevas (nada de
librerías de gráficos), sin tocar transfer-policy, los mappers ni la lógica existente, sin
importar entre features. Piezas: una función de dominio pura, un store con signals y la página
(más un presentacional para la lista). Ruta /expenses lazy con title 'Gastos' solo en la ruta
(sin el servicio Title) y la entrada en la barra del shell y en el menú hamburguesa. En
iteraciones siguientes pedí poder separar los gastos por cuenta (elegí un selector de cuenta
derivado de los propios gastos, ocultando el de moneda cuando hay una cuenta elegida y sin
re-leer) y que ese selector mostrara el nombre con el formato "Nombre - id (moneda)".

### Decisiones que tomé yo (fijadas en el prompt o elegidas entre las alternativas de Kiro)
- **Qué es un gasto:** SOLO type 'expense' con status 'completed'. Las transferencias (aunque
  sean salientes) no son gastos, y las fallidas o pendientes no movieron dinero. La función de
  dominio filtra otra vez aunque la consulta ya lo haga.
- **Nunca mezclar monedas:** el resumen es por moneda (selector con las monedas que aparecen en
  los gastos), sin total general. Suma con Money.plus (centavos exactos), nada de floats.
- **Período:** "Todo el historial" (por defecto) o un mes; los meses salen de los datos, del más
  reciente al más antiguo. El mes se define en la zona horaria local del navegador, no en UTC
  (un gasto de 02:00Z del 1 de octubre es septiembre en Buenos Aires): la función de dominio
  recibe la zona por parámetro y usa Intl.DateTimeFormat con timeZone, no Date.getMonth(). La
  página le pasa Intl.DateTimeFormat().resolvedOptions().timeZone.
- **Lectura:** TransactionPort.list con type expense, status completed y pageSize 50, recorriendo
  todas las páginas en secuencia con tope de 20. Nunca un resumen con datos incompletos: si se
  supera el tope o falla una página, error con reintento y ningún total. Contador de generación
  chequeado tras cada await y en los fallos. Se lee al entrar y con un botón Actualizar
  (disabledInteractive con guard propio contra el doble clic). Cambiar de período, de moneda o de
  cuenta NO vuelve a leer: solo recomputa en el dominio.
- **Dominio:** summarizeExpenses(transactions, { currency, period, accountId, timeZone, labelOf })
  devuelve el total del período como Money y las categorías con su Money, su cantidad y su
  proporción (0..1, solo para el ancho de la barra), de mayor a menor; el empate se desempata por
  el texto en español, que llega como labelOf(category) porque el dominio no puede importar de
  shared/ui. Más monthsWithData, currenciesWithData y accountsWithData.
- **Separación por cuenta (Opción A, y no la B de desglose dentro del resumen):** un selector
  "Cuenta" con "Todas las cuentas" (por defecto) + las cuentas presentes en los gastos, derivadas
  por accountsWithData (cada una con su moneda, en orden de aparición, sin lecturas extra). Al
  elegir una cuenta, la moneda queda implícita en la de la cuenta y el selector de moneda se
  oculta; con "Todas las cuentas" vuelve. Como cada cuenta tiene una sola moneda, filtrar por
  cuenta nunca mezcla monedas. summarizeExpenses y monthsWithData aceptan un accountId opcional
  (null = todas) y filtran también por cuenta. Cambiar de cuenta resetea el período a "Todo el
  historial" para no mostrar un mes sin datos en ese alcance.
- **Nombre en el label del selector de cuenta:** inyecté AccountsStore en la página SOLO para
  resolver el nombre (mapa id -> name), con ensureLoaded() una vez en paralelo; el resumen no
  espera a esa lectura. El label es "Nombre - id (moneda)" y, si el nombre aún no cargó, falló o
  la cuenta no está en AccountsStore, cae a "id (moneda)" para no romper la fila. Dejé el id
  completo aunque haya nombre, porque los nombres pueden repetirse y lo que distingue una cuenta
  es el id.
- **Pantalla:** h1 "Gastos", selectores de cuenta, moneda y período con labels, el total con
  MoneyAmount y la lista de categorías ordenada (nombre en español con categoryLabel, monto y una
  barra CSS). Las barras usan un solo token (--color-primary) sobre un fondo de token y son
  decorativas (aria-hidden); la representación accesible es una tabla real con caption ("Gastos
  por categoría, ARS, octubre de 2026", con la cuenta cuando hay una elegida) y columnas Categoría
  y Monto. Estados: cargando, error con reintento, "Todavía no registraste gastos" (ninguno) y
  "No hay gastos en este período" (período vacío). Región aria-live polite que anuncia el
  resultado al cambiar cuenta, período o moneda. Una sola columna, 320 px, dos temas.
- **Tests:** solo los de la función de dominio (suma exacta 0,10+0,20=30 centavos, nunca mezcla
  monedas, solo cuentan gastos completados, el mismo gasto cae en octubre o septiembre según la
  zona, orden y empates, período vacío, filtro por cuenta en summarizeExpenses y monthsWithData, y
  accountsWithData con orden de aparición e ignorando transfers/ingresos/pending/failed). Sin
  tests de componente ni de integración para esta pantalla.

### Supuesto que avisé
- En el repo no existe un componente "app-spinner"; el estado de carga usa el StatePanel (que ya
  trae role="status" y mat-progress-spinner), igual que el resto de las pantallas. El botón
  Actualizar reusa el mat-progress-spinner inline como en la lista de cuentas.

### Test preexistente actualizado (avisado)
- shell.component.spec.ts enumeraba tres links de navegación; pasó a verificar los cuatro con
  "Gastos" al final. El test de títulos por ruta no cambió (solo comprueba las tres rutas
  previas).

**Resultado:** features/expenses con la función de dominio (summarizeExpenses, monthsWithData,
currenciesWithData, accountsWithData y el filtro opcional por accountId) y sus tests, el store con
signals (todas las páginas, tope 20, generación, sin resumen parcial), la página con los selectores
de cuenta/moneda/período y un presentacional de lista con la tabla accesible y las barras CSS; ruta
/expenses lazy (title en la ruta) y la entrada "Gastos" en el shell. De 604 a 621 tests (17 de
dominio entre la creación y la separación por cuenta), ng build OK (el warning de budget es previo
y la feature va en chunk lazy).

**Decisión:** ✅ aceptado
**Por qué:** Acepté la implementación porque el resumen mantiene el dinero en el dominio (suma exacta en centavos y sin mezclar monedas) y respeta que la zona horaria defina el mes. El filtro por cuenta reusa el mismo resumen de dominio sin re-leer, con las cuentas salidas de los propios gastos y el nombre con fallback al id.
