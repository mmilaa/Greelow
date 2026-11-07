# Stack y convenciones

- Angular 22.2 (CLI 22.2.6), TypeScript ~6.0 con strict + strictTemplates, Node 24, npm.
- Tests: Vitest 5 + jsdom (configurado por el scaffold). Comando: ng test.
- Estilos: SCSS. Sin SSR.
- SOLO standalone components (sin NgModules). Control flow nativo (@if, @for, @switch).
- Estado con signals; inyección con inject(); ChangeDetectionStrategy.OnPush.
- Lógica de negocio en TypeScript puro, en funciones y clases pequeñas.
- No agregar librerías sin preguntarme antes (justificar cada dependencia).
- CORS: probado desde el navegador, no da problemas. No hace falta proxy.conf.json.
  NO tocar mock-api.
- Token en sessionStorage (es mock; en producción iría en cookie httpOnly), detrás de
  TokenStoragePort. GET /auth/me rehidrata la sesión al recargar y un guard protege las
  rutas. El interceptor solo agrega el header. El 401 se resuelve como dice structure.md.
- Código en inglés, textos de UI en español.
- Cada respuesta termina con: qué hiciste, qué supuestos tomaste y qué te quedó dudoso.
- No modificar DECISIONS.md ni PROMPT_LOG.md: a menos que lo especifique yo.
- Formularios: Reactive forms
- Money: mapa de decimales por moneda en Currency (ARS=2, USD=2, EUR=2).
- Los pendientes salientes los lee PendingTransfersPort.pendingOutgoing(): GET /transactions
  ?status=pending&type=transfer sin accountId, todas las páginas, tope de 20, y falla sin
  devolver una lista parcial. availableBalance filtra por cuenta.
- UI: Angular Material
- Material solo se usa en `ui/` y `shared/ui/`. Prohibido importarlo desde domain,  application o infrastructure.
- No agregar otras librerías de UI ni de estilos.
- Los colores se usan solo a través de los tokens definidos en el archivo de estilos globales. Prohibido hardcodear colores (hex, rgb, "white", "black") en componentes. Los tokens se nombran por función (superficie, texto, positivo, negativo), no por color.
## Trabajo con Kiro
- Los tests se escriben junto con la implementación. TDD solo se aplicó a Money y
  transfer-policy. Nunca modificar un test para que pase: si parece incorrecto, avisar.
- Cambios acotados al alcance del prompt. No tocar lo ya cerrado sin pedirlo.
- Cuando el prompt pide una propuesta, no escribir código hasta que yo elija.
- Verificar con comandos (tests, build, búsquedas) y mostrar la salida, no a ojo.
- Los tests se corren siempre con `ng test` (el builder carga el entorno de Angular). Nunca
  `npx vitest` directo: falla con errores de compilación JIT que no son del código.
- Un test que lleva un bucle a un crash no se elimina: se diagnostica.

## Dinero en la interfaz
- Siempre con el código de moneda: ARS 1.234,56. El negativo lleva signo y no depende solo
  del color. Cifras tabulares y sin cortes de línea. formatMoney vive en shared/domain.
- Los movimientos pending o failed se muestran atenuados con su chip de estado.

## Estilos y accesibilidad
- Tokens en src/styles/tokens.scss (único archivo con colores). Después de cambiar uno se
  corre tools/contrast.mjs, que lee ese archivo.
- html lang="es". Todo botón que solo tiene ícono lleva aria-label en español. Los errores y
  la carga se anuncian (role="alert" o aria-live). Íconos: Material Symbols.