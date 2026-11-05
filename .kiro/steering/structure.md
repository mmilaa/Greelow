# Arquitectura
La app Angular está en `frontend/`. Todo el código nuevo va ahí, nunca en la raíz ni en `mock-api/`.

Por features, con capas y dependencias hacia adentro:

frontend/src/app/
   core/            auth, interceptors, guards, config, mapeo central de errores
   shared/
    domain/      Money, Currency y errores comunes. TS puro (sin @angular/*)
    ui/          UI genérica y el pipe de formato de dinero (usa formatMoney de shared/domain)
   features/<feature>/
    domain/          entidades, Money, reglas. PROHIBIDO importar @angular/* o HttpClient
    application/     casos de uso, stores con signals, puertos (abstract classes como token de DI)
    infrastructure/  adaptadores HttpClient, DTOs y mappers DTO -> dominio
    ui/              componentes sin lógica de negocio + páginas

Reglas:
1. Los componentes solo muestran estado y disparan acciones. Cero reglas de negocio.
2. Dinero: value object `Money` (unidades mínimas enteras + moneda). Nunca floats sueltos.
   El mapper convierte a centavos al entrar (Math.round(x * 100)) y a decimal al enviar.
   Suma y resta solo entre la misma moneda (error de dominio si no).
3. Las decisiones ambiguas viven en UN solo lugar de dominio/aplicación:
   `transfer-policy.ts` (moneda, fondos, saldo disponible) y un tracker de liquidación
   (polling acotado). Ningún componente decide esto.
4. Errores: un único mapeo central (en `core/`) convierte las respuestas de error de la
   API en errores de dominio, y de ahí a mensajes de usuario. El mapeo distingue por
   status Y por la forma del cuerpo, no por el texto del mensaje:
   - Cuerpo `{ errors: [{ field, message }] }` -> error de validación por campo
     (400 en alta de movimiento y transferencia).
   - Cuerpo `{ error: string }` -> error de regla de negocio. El significado lo da el
     status y el contexto de la llamada, no el texto:
       * 400 en POST /transfers: misma cuenta de origen y destino.
       * 404 en POST /transfers: cuenta origen o destino inexistente.
       * 422 en POST /transfers: fondos insuficientes.
   - 401 en cualquier request: limpiar sesión y redirigir a login.
   - Cualquier forma o status desconocido: mensaje genérico según el status; nunca
     mostrar al usuario el texto crudo de la API.
5. Los mappers toleran null (from/to, direction, counterpartAccountId) y el estado `failed`.
6. totalPages y demás cálculos de paginación se hacen en dominio.
7. Tests de dominio SIN Angular ni API real (Vitest puro). Tests de application con
   fakes de los puertos; si el store necesita contexto de inyección, usar
   TestBed.runInInjectionContext y no levantar componentes.
8. Fixtures mínimos, derivados de las respuestas en docs/api-samples/.
9. `Money` vive en `shared/domain/` y lo usan todas las features. Las features pueden
   importar de `shared/`, pero `shared/` no importa de ninguna feature.