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

## #02 · Respuestas a Kiro y arranque del dominio · 2026-11-0X
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
