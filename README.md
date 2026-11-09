# MilaPay — billetera virtual

Ejercicio técnico de Frontend (Greelow, 2026). Aplicación web en Angular sobre el mock-api del ejercicio: un usuario inicia sesión, ve sus cuentas con saldo, consulta sus movimientos, registra ingresos y gastos, ve un resumen de sus gastos por categoría y transfiere entre sus propias cuentas.

Las decisiones, con su justificación, están en [DECISIONS.md](DECISIONS.md).

## Requisitos

- Node.js 24 y npm (desarrollado con Node 24.22.2 y npm 11.19.1).
- Dos terminales.

## Cómo correrlo

**1. API (terminal 1)**

```bash
cd mock-api
npm install
npm run seed  # Crea data.db con los datos iniciales; volver a correrlo resetea todo
npm run dev   # http://localhost:3000
```

**2. App (terminal 2)**

```bash
cd frontend
npm install
npm start     # http://localhost:4200
```

No hace falta configurar nada más: la API permite el origen de la app y la URL base está en `frontend/src/app/core/config`. No se modificó el mock-api.

### Usuarios de prueba

| Email | Contraseña | Cuentas |
|---|---|---|
| `demo@example.com` | `demo123` | Cuenta Pesos (ARS) y Cuenta Dólares (USD) |
| `test@example.com` | `test123` | Cuenta Principal (ARS) |
| `ana@example.com` | `ana123` | Cuenta de Ana (ARS) |

Para probar una transferencia hay que tener **dos cuentas en la misma moneda**. Con el seed ningún usuario las tiene: creá una segunda cuenta en pesos con "Nueva cuenta".

## Recorrido sugerido (unos 5 minutos)

1. Iniciá sesión con `demo@example.com`.
2. En **Cuentas**, creá una segunda cuenta en pesos ("Nueva cuenta"; la moneda no se puede cambiar después).
3. Entrá al detalle de **Cuenta Pesos**: tarjeta, últimos movimientos y acciones.
4. Registrá un gasto y un ingreso desde el detalle (el monto se escribe con coma o punto, hasta 2 decimales).
5. En "Ver todos" probá los filtros, la búsqueda y la paginación (quedan en la URL).
6. En **Transferencias**, enviá una transferencia de Cuenta Pesos a la cuenta nueva: pasa por "Procesando" y a los ~2 segundos queda "Completada".
7. Probá lo que debería rechazar: un destino en otra moneda (aparece deshabilitado con el motivo) y un monto mayor al disponible.
8. En **Gastos**, mirá el resumen por categoría y cambiá la moneda y el período. Con los datos del seed, "octubre de 2026" en pesos suma ARS 417.000,00 en cuatro categorías; el gasto que registraste en el paso 4 aparece en el mes actual. Las transferencias entre tus cuentas no cuentan como gastos y las monedas nunca se suman entre sí.
9. Cambiá el tema (Sistema, Claro u Oscuro) con el botón de la barra, a la izquierda del menú de usuario.

## Estructura

```text
mock-api/            API del ejercicio, sin modificar
frontend/            App Angular 22 (standalone, signals, TypeScript estricto)
  src/styles/        tokens de diseño por función (colores, espacios), con tema claro y oscuro
  src/app/
    core/             URL base, ejecución de pedidos HTTP, adaptadores de puertos compartidos
    shared/           dominio común (Money, errores, fechas), puertos, stores y UI genérica
    features/         auth, accounts, transactions, transfers, expenses
                      cada una con las capas que necesita (domain, application, infrastructure, ui)
    theme/            elección de tema (Sistema, Claro, Oscuro) y su persistencia
    app.providers.ts  raíz de composición: acá se ligan los puertos con sus adaptadores
docs/api-samples/     respuestas reales de la API que usé como evidencia
.kiro/steering/       contexto persistente que le di a la IA
```

## Tests y calidad

```bash
cd frontend
npx ng test --no-watch
npx ng build
```

## Uso de IA

La estrategia, los prompts y qué acepté, corregí o rechacé están en [PROMPT_LOG.md](PROMPT_LOG.md).