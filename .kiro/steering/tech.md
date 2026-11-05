# Stack y convenciones

- Angular 22.2 (CLI 22.2.6), TypeScript ~6.0 con strict + strictTemplates, Node 24, npm.
- Tests: Vitest 5 + jsdom (configurado por el scaffold). Comando: ng test.
- Estilos: SCSS. Sin SSR.
- SOLO standalone components (sin NgModules). Control flow nativo (@if, @for, @switch).
- Estado con signals; inyección con inject(); ChangeDetectionStrategy.OnPush.
- Lógica de negocio en TypeScript puro, en funciones y clases pequeñas.
- No agregar librerías sin preguntarme antes (justificar cada dependencia).
- Formularios: no está decidido. Proponer opciones con trade-offs (Reactive Forms vs
  Signal Forms) y esperar mi decisión antes de implementar.
- CORS: el README del mock no dice nada. Probar desde el navegador; si falla, usar
  proxy.conf.json de `ng serve`. NO tocar mock-api.
- Token en sessionStorage (es mock; en producción iría en cookie httpOnly).
  Un interceptor agrega el header; un 401 limpia la sesión y redirige a login;
  un guard protege rutas; GET /auth/me rehidrata la sesión al recargar.
- Código en inglés, textos de UI en español.
- Cada respuesta termina con: qué hiciste, qué supuestos tomaste y qué te quedó dudoso.
- No modificar DECISIONS.md ni PROMPT_LOG.md: a menos que lo especifique yo.
- Formularios: Reactive forms
- Money: mapa de decimales por moneda en Currency (ARS=2, USD=2, EUR=2).
- Los pending salientes se leen de GET /transactions?status=pending&type=transfer
filtrando direction === "out" (el README no tiene listado de /transfer)
- UI: Angular Material
- Material solo se usa en `ui/` y `shared/ui/`. Prohibido importarlo desde domain,  application o infrastructure.
- No agregar otras librerías de UI ni de estilos.