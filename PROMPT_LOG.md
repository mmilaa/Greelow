## #00 · Planificación y exploración previa · 2026-11-04
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