# Arquitectura

La app Angular está en `frontend/`. Todo el código nuevo va ahí, nunca en la raíz ni en
`mock-api/`. Organización por features con capas; las dependencias apuntan hacia adentro.

frontend/src/app/
  app.config.ts, app.routes.ts, app.providers.ts   raíz de composición: acá se ligan los
                                                   puertos con sus adaptadores y se
                                                   registran los interceptors
  shell/, session-redirect.ts                      layout y efecto de expiración de sesión
                                                   (usan Router; no van en core)
  core/
    config/   API_BASE_URL
    http/     ApiRequestRunner, runRequest, ON_UNAUTHENTICATED
    data/     adaptadores HTTP de los puertos de shared (PendingTransfersHttpAdapter)
  shared/
    domain/          TS puro: Money, Currency, errores, ApiError/mapApiError/ApiErrorException,
                     Transaction, Account, Page, availableBalance, signedAmount, formatMoney,
                     formatDateTime, parse
    application/     puertos que usan varias features (PendingTransfersPort, TransactionPort)
    infrastructure/  DTO y mapper de Transaction (lo usan transactions y transfers)
    ui/              MoneyAmount, StatusChip, PageHeader, StatePanel y el catálogo de mensajes
  features/<feature>/   (auth, accounts, transactions, transfers)
    domain/          entidades y reglas propias de la feature
    application/     stores con signals y puertos propios (abstract classes como token de DI)
    infrastructure/  adaptadores HttpClient, DTOs y mappers
    ui/              componentes y páginas, sin lógica de negocio

## Qué puede importar cada capa
- domain (en shared y en features): nada de @angular/*, HttpClient ni DTOs. TypeScript puro.
- application: @angular/core (signals, inject) sí. NO HttpClient, Router, rxjs ni APIs del
  navegador (sessionStorage): eso va en infrastructure.
- infrastructure, core/http y core/data: HttpClient y Angular sí.
- ui: Angular y Material sí. Material solo se usa acá.
- shared no importa de core ni de ninguna feature. core importa de shared, nunca de features.
- Una feature importa de shared y de core, nunca de otra feature (ni en dominio ni en
  infraestructura). Lo que cruza features vive en shared.
- Solo la raíz de composición (app/) conoce todas las piezas.

## Reglas
1. Los componentes solo muestran estado y disparan acciones. Cero reglas de negocio.
2. Dinero: value object `Money` (unidades mínimas enteras + moneda), nunca floats sueltos.
   Se construye con Money.fromDecimal(monto, moneda): el factor sale del mapa de decimales
   de Currency, y un valor no finito o fuera del rango seguro lanza InvalidAmountError. Al
   enviar a la API vuelve a decimal con toDecimal(). Sumar, restar o comparar monedas
   distintas lanza CurrencyMismatchError. Nunca hay un total que mezcle monedas.
3. Las decisiones ambiguas viven en un solo lugar de dominio, no en componentes:
   transfer-policy.ts (moneda y fondos), availableBalance en shared/domain (saldo
   disponible) y settlement.ts (cuándo seguir o dejar de consultar una transferencia).
4. Errores: un único mapeo (mapApiError, en shared/domain) convierte una respuesta de error en
   un ApiError, según status, FORMA del cuerpo y operación, nunca según el texto:
   - status 0: network.
   - 400 con { errors: [...] } no vacío: validation. 400 con { error } es same-account solo en
     create-transfer; en otro contexto, unknown.
   - 401: invalid-credentials en login; unauthenticated en cualquier otra operación.
   - 404: not-found. 422: insufficient-funds solo en create-transfer; si no, unknown.
   - Cualquier otra cosa: unknown con su status.
   - Un 2xx con cuerpo corrupto lo marca el adaptador como invalid-response.
   Operaciones: login, create-account, create-transaction, create-transfer, read.
   runRequest (core/http) hace esa conversión y lanza ApiErrorException; ante unauthenticated
   llama a ON_UNAUTHENTICATED, que la raíz conecta con session.expire(). El interceptor solo
   agrega el header Authorization y solo a URLs del origen de API_BASE_URL. La redirección a
   /login la hace SessionRedirect (app/) al pasar de authenticated a anonymous por expiración.
   Los mensajes en español salen del catálogo de shared/ui: nunca el texto crudo de la API.
5. Mappers: lanzan InvalidDataError ante un dato inválido en id, amount, currency, type,
   status, direction o createdAt; normalizan description y category ausentes. Toleran null en
   counterpartAccountId y transferId. Una transferencia con from y to ambos nulos lanza.
6. totalPages y demás cálculos de paginación se hacen en dominio.
7. Tests: el dominio sin Angular ni API real (Vitest puro). Los stores con fakes de los puertos
   (TestBed.runInInjectionContext si necesitan inject, sin levantar componentes). Adaptadores,
   interceptor y guard con TestBed y HttpTestingController: es la excepción, porque son el
   borde con Angular. De los componentes solo se prueba el comportamiento, no el DOM ni los
   estilos de Material.
8. Fixtures mínimos, derivados de las respuestas en docs/api-samples/.
9. Rutas: páginas lazy con loadComponent, un título por ruta. El shell va eager como ruta
   padre con authGuard y envuelve las privadas.
10. Vocabulario: en el código la entidad es Transaction; en la interfaz se dice "Movimientos".