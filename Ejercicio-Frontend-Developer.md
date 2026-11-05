# Ejercicio – Frontend Developer (versión 2026)

Desarrollar una **aplicación web para un producto fintech** sobre una API que te damos nosotros.
El foco está en el **criterio de producto frente a datos de dinero, el manejo de estados y errores, y cómo pensás y documentás una consigna que a propósito no te dice todo**. El uso estratégico de Inteligencia Artificial también forma parte de lo que evaluamos.

Este ejercicio es **agnóstico de framework**: no es un ejercicio de React. Podés resolverlo con React, Vue, Angular, Svelte, Solid, o incluso HTML/CSS/JS sin framework. Lo que evaluamos es tu criterio, no el framework que elegiste.

---

## Por qué fintech

En Greelow trabajamos en proyectos de fintech. Antes de evaluar si sabés usar un framework, queremos ver cómo razonás frente a datos de dinero: montos, monedas, estados de una operación, qué pasa cuando algo falla. Son decisiones que en un dashboard de recetas de cocina no importan demasiado, pero en fintech sí.

---

## Objetivo

Construir un **producto fintech** (a tu elección) sobre la API que te damos. Algunos ejemplos de qué podría ser:

- Una billetera personal (ver saldo, movimientos, transferir)
- Un control de gastos / dashboard de finanzas personales
- Un panel de administración de cuentas para un negocio chico
- Lo que se te ocurra, siempre dentro del dominio de la API

La API expone cuentas (`accounts`), movimientos (`transactions`) y transferencias (`transfers`). Tu trabajo es darle **sentido de producto** a esos datos a través de la UI y la experiencia.

---

## API Mock

Te damos una API REST fintech, lista para correr localmente:

**`mock-api/`** (en este mismo repositorio)

Ahí encontrás:
- Instrucciones de instalación y ejecución (`mock-api/README.md`)
- Documentación de todos los endpoints, con ejemplos de curl
- Datos de prueba pre-cargados (3 usuarios, 4 cuentas, ~20 movimientos)
- Un test suite (`npm run test`) que podés correr para confirmar que no rompiste nada si la tocás

No necesitás (ni deberías) modificar el código del mock-api para resolver el ejercicio. Es tu backend, tratalo como una caja negra — pero **leé bien su README**, porque ahí está parte de la consigna.

---

## Lo que la consigna no te dice a propósito

Esto no es un descuido. Hay al menos tres puntos donde la API tiene un comportamiento real y nosotros no te decimos qué hacer con él en la UI:

1. **Multi-moneda.** Las cuentas tienen moneda propia (ARS, USD, EUR). Si transferís entre cuentas de monedas distintas, la API **no convierte nada** — el monto queda registrado tal cual en cada lado. ¿Qué hace tu producto con eso? ¿Lo permitís, lo advertís, lo bloqueás, mostrás una conversión aproximada del lado del cliente? Vos decidís.

2. **Estados asincrónicos.** Una transferencia nace en estado `pending` y se liquida sola a `completed` un segundo y medio después, sin que nadie vuelva a llamar a ningún endpoint. ¿Cómo te enterás de ese cambio en la UI? ¿Pollean, refrescás al volver a la pantalla, mostrás un estado "procesando" y no hacés nada más? Vos decidís.

3. **Fondos insuficientes.** Si una transferencia supera el saldo disponible, la API devuelve un error 422. ¿Cómo se lo mostrás al usuario? ¿Validás antes de enviar o dejás que falle y mostrás el error? Vos decidís.

**Lo que evaluamos no es si adivinaste "la" respuesta correcta — no la hay.** Evaluamos si te das cuenta de que hay una decisión para tomar, qué hacés para resolverla (leer la API, probarla, preguntar si tuvieras a quién), y si documentás por qué elegiste lo que elegiste.

Si en el camino te surgen más preguntas de este tipo (seguro te van a surgir), tratalas igual: documentá el supuesto que tomaste y la razón.

---

## Requisitos funcionales mínimos

- **Autenticación:** Login con email y contraseña (usá alguno de los usuarios de prueba del seed).
- **Listado de cuentas:** Con su balance.
- **Listado de movimientos:** De una cuenta o de todas, con filtro y/o búsqueda, y paginación.
- **Alta de movimiento:** Registrar un ingreso o un gasto.
- **Transferencia:** Entre cuentas propias o hacia la cuenta de otro usuario.
- **Feedback visual:** Estados de carga, error y vacío — incluyendo cómo reflejás el estado `pending` → `completed` de una transferencia.

---

## Requisitos de arquitectura

Evaluamos cómo estructurás y separás responsabilidades. **No hay una única forma correcta** — podés usar Clean Architecture, Feature-Sliced Design, o tu propio approach. Esto aplica sea cual sea el framework que elijas.

Lo importante es que tu código sea:

- **Desacoplado:** La lógica de negocio (cálculo de balances, reglas sobre qué se puede o no editar, manejo de los tres puntos ambiguos de arriba) no depende del framework de UI ni de los detalles de la API.
- **Testeable:** Podés testear esa lógica sin levantar la UI ni la API real.
- **Mantenible:** La estructura es clara y permite hacer cambios sin romper todo.

### Algunas preguntas que nos hacemos al revisar:

- ¿Los componentes de UI están libres de lógica de negocio?
- ¿Podrías cambiar de librería de estado, o de framework, sin reescribir la lógica de negocio?
- ¿Se puede testear la lógica de forma aislada?
- ¿Cómo encapsulaste las decisiones de los tres puntos ambiguos? ¿En un solo lugar o repartidas por todos los componentes?

**No pedimos que sigas un patrón específico.** Pedimos que justifiques tus decisiones.

---

## Requisitos técnicos

- **Framework:** El que quieras (React, Vue, Angular, Svelte, Solid, vanilla JS/TS, etc.). Elegí el que mejor te permita mostrar tu criterio, no el que creas que "esperamos".
- **TypeScript:** Recomendado si tu stack lo soporta. Si no lo usás, justificá por qué en `DECISIONS.md`.
- **Gestión de estado y estilos:** A tu elección.
- **README.md:** Con instrucciones claras para instalar y ejecutar (incluyendo cómo levantar el mock-api).

---

## Criterios de evaluación

| Área | Qué evaluamos |
|------|---------------|
| **Pensamiento crítico** | ¿Identificaste los puntos ambiguos de la consigna? ¿Cómo los resolviste y por qué? |
| **Criterio de producto fintech** | Manejo de montos, monedas, estados de una operación y errores — ¿se entiende lo que está pasando con tu dinero en todo momento? |
| **Desacoplamiento** | ¿La lógica de negocio es independiente del framework y de la API? |
| **Testeabilidad** | ¿Se puede testear la lógica sin UI ni API real? |
| **Estructura** | ¿El código está organizado de forma clara y navegable? |
| **Manejo de errores** | ¿Los errores de la API (400, 404, 422) se manejan y comunican correctamente? |
| **Calidad de código** | Claridad, consistencia, naming. |
| **Testing** | Al menos tests de la lógica de negocio. |
| **Justificación** | ¿Puede explicar por qué tomó las decisiones que tomó? (`DECISIONS.md`) |
| **Uso de IA** | Estrategia de prompting documentada, y criterio para aceptar/rechazar lo que la IA propuso. |

---

## Uso de Inteligencia Artificial

El uso de herramientas de IA (Claude, ChatGPT, Copilot, etc.) es **esperado y valorado**. No evaluamos si usaste IA — asumimos que sí. Evaluamos:

- Cómo estructurás los prompts (por capas, por funcionalidad, para resolver cada uno de los puntos ambiguos, etc.)
- Qué ajustes y revisiones aplicás al output.
- Tu criterio para aceptar, modificar o rechazar sugerencias — en particular, cuando la IA te propone una solución para multi-moneda, estados async o manejo de errores: ¿la aceptaste tal cual o la cuestionaste?

**Entregable:** Incluí un archivo `PROMPT_LOG.md` o `AI_NOTES.md` documentando tu estrategia.

---

## Entregables obligatorios

1. **Repositorio** con el código fuente y README claro. Invitá a **`nicolasmiddi`** como colaborador del repositorio que crees para la entrega.

2. **DECISIONS.md** con al menos 3 trade-offs justificados. Tiene que incluir, como mínimo, cómo resolviste **los tres puntos ambiguos** de la sección anterior. Otros ejemplos de qué más puede ir ahí:
   - *"Elegí Zustand/Pinia/Signals en lugar de X porque..."*
   - *"Organicé el código de esta manera porque..."*
   - *"No implementé X porque..."*

3. **PROMPT_LOG.md** o **AI_NOTES.md** explicando cómo usaste IA.

---

## Bonus (opcional, valor agregado)

- TDD (Test-Driven Development)
- Conversión real de moneda en el punto 1 (ej: usando una API pública de cotizaciones)
- Optimistic updates
- Polling o actualización en vivo del estado de una transferencia
- Accesibilidad (a11y)
- Deploy online (Vercel, Netlify, etc.)
- Archivo `ARCHITECTURE.md` explicando tus decisiones de diseño

---

## Libertad creativa

Más allá de los requisitos mínimos, tenés libertad para:

- Elegir qué producto fintech construís (billetera, control de gastos, panel de cuentas, etc.)
- Diseñar la UI como quieras
- Agregar features adicionales
- Elegir las herramientas que prefieras

Lo importante es que tus decisiones estén **justificadas** y que se note que pensaste la consigna, no solo que la ejecutaste.
