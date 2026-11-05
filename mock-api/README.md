# Mock API Fintech

API REST chica para el ejercicio de frontend 2026. Usa SQLite y Express.

Dominio: cuentas (`accounts`), movimientos (`transactions`: ingresos y gastos) y transferencias entre cuentas (`transfers`).

## Instalacion

```bash
cd mock-api
npm install
```

## Seed (crear tablas y datos iniciales)

```bash
npm run seed
```

Esto crea el archivo `data.db` con 3 usuarios, 4 cuentas y ~20 movimientos de ejemplo (incluida una transferencia ya liquidada).

**Usuarios de prueba:**

| Email | Password | Nombre | Cuentas |
|-------|----------|--------|---------|
| `demo@example.com` | `demo123` | Usuario Demo | Cuenta Pesos (ARS), Cuenta Dolares (USD) |
| `test@example.com` | `test123` | Test User | Cuenta Principal (ARS) |
| `ana@example.com` | `ana123` | Ana Perez | Cuenta de Ana (ARS) |

> **Tip:** Si queres resetear la base de datos y volver a los datos iniciales, simplemente corré `npm run seed` de nuevo.

## Levantar el servidor

```bash
npm run dev
```

El servidor corre en `http://localhost:3000`.

## Tests

Con el servidor corriendo en `localhost:3000`:

```bash
npm run test
```

Ejecuta ~20 tests que cubren auth, cuentas, movimientos y transferencias (incluyendo la liquidación asincrónica).

---

## Endpoints

### Auth

#### Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@example.com", "password": "demo123"}'
```

Response:
```json
{
  "token": "fake-token-user-1",
  "user": { "id": "user-1", "email": "demo@example.com", "name": "Usuario Demo" }
}
```

#### Get current user
```bash
curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer fake-token-user-1"
```

---

### Accounts

Todas las rutas de `accounts`, `transactions`, `transfers` y `categories` requieren el header `Authorization: Bearer <token>`.

#### List accounts (incluye balance calculado)
```bash
curl http://localhost:3000/accounts \
  -H "Authorization: Bearer fake-token-user-1"
```

El `balance` se calcula en el servidor a partir de los movimientos con `status: "completed"` de esa cuenta. No se persiste como columna.

#### Get account by id
```bash
curl http://localhost:3000/accounts/acc-1 \
  -H "Authorization: Bearer fake-token-user-1"
```

#### Create account
```bash
curl -X POST http://localhost:3000/accounts \
  -H "Authorization: Bearer fake-token-user-1" \
  -H "Content-Type: application/json" \
  -d '{"name": "Cuenta Ahorro", "currency": "ARS"}'
```

`currency` debe ser una de: `ARS`, `USD`, `EUR`.

#### Update account
```bash
curl -X PUT http://localhost:3000/accounts/acc-1 \
  -H "Authorization: Bearer fake-token-user-1" \
  -H "Content-Type: application/json" \
  -d '{"name": "Nuevo nombre"}'
```

**Nota:** la moneda de una cuenta es inmutable una vez creada. Si el body incluye `currency`, se ignora silenciosamente.

---

### Transactions

#### List transactions (con filtros y paginación)
```bash
curl "http://localhost:3000/transactions?accountId=acc-1&category=groceries&page=1&pageSize=10" \
  -H "Authorization: Bearer fake-token-user-1"
```

Query params soportados (todos opcionales, combinables): `accountId`, `type` (`income`|`expense`|`transfer`), `category`, `status` (`pending`|`completed`|`failed`), `search` (sobre `description`), `page`, `pageSize` (default 10, máx 50).

Solo devuelve movimientos de cuentas propias del usuario autenticado.

#### Get transaction by id
```bash
curl http://localhost:3000/transactions/txn-1 \
  -H "Authorization: Bearer fake-token-user-1"
```

#### Create transaction (ingreso o gasto)
```bash
curl -X POST http://localhost:3000/transactions \
  -H "Authorization: Bearer fake-token-user-1" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "acc-1",
    "type": "expense",
    "amount": 5000,
    "category": "groceries",
    "description": "Supermercado"
  }'
```

`type` solo acepta `income` o `expense` en este endpoint. Para mover dinero entre cuentas, usá `/transfers`. El movimiento se crea con `status: "completed"` de forma inmediata.

#### Update transaction metadata
```bash
curl -X PATCH http://localhost:3000/transactions/txn-1 \
  -H "Authorization: Bearer fake-token-user-1" \
  -H "Content-Type: application/json" \
  -d '{"category": "other", "description": "Descripcion editada"}'
```

Solo se pueden editar `category` y `description`. El `amount` es inmutable una vez creado, y las transferencias no se pueden editar (devuelve `400`).

---

### Transfers

#### Create transfer
```bash
curl -X POST http://localhost:3000/transfers \
  -H "Authorization: Bearer fake-token-user-1" \
  -H "Content-Type: application/json" \
  -d '{
    "fromAccountId": "acc-1",
    "toAccountId": "acc-4",
    "amount": 5000,
    "description": "Pago compartido"
  }'
```

`toAccountId` puede ser una cuenta propia o de **otro usuario** (es una transferencia P2P). Comportamiento a tener en cuenta:

- Si `amount` supera el balance disponible de `fromAccountId`, devuelve `422` con un error estructurado — la transferencia no se crea.
- Si es válida, la transferencia se crea con `status: "pending"` y **se liquida sola** (pasa a `"completed"`) un segundo y medio después, sin que nadie vuelva a llamar al endpoint. Hay que consultar `GET /transfers/:id` (o refrescar el listado de `transactions`) para ver el cambio de estado.
- Si las cuentas de origen y destino tienen **monedas distintas**, la API no hace ninguna conversión: el mismo `amount` queda registrado tal cual en ambos lados, cada uno con la moneda de su propia cuenta.

Ninguno de estos tres puntos es un detalle menor de implementación — son decisiones de producto que la consigna del ejercicio deja a propósito sin resolver.

#### Get transfer by id
```bash
curl http://localhost:3000/transfers/transfer-seed-1 \
  -H "Authorization: Bearer fake-token-user-1"
```

Cada usuario solo ve el lado de la transferencia que le corresponde a sus propias cuentas (`from` o `to` puede venir en `null`).

---

### Categories

```bash
curl http://localhost:3000/categories \
  -H "Authorization: Bearer fake-token-user-1"
```

Lista fija: `salary`, `freelance`, `rent`, `groceries`, `transport`, `entertainment`, `utilities`, `health`, `transfer`, `other`.

---

## Validaciones

La API valida los campos y devuelve `400 Bad Request` si algo esta mal:

```json
{
  "errors": [
    { "field": "amount", "message": "amount must be at least 0.01" },
    { "field": "currency", "message": "currency must be one of: ARS, USD, EUR" }
  ]
}
```

### Reglas de validacion

| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| `name` (cuenta) | string | si | 2-100 caracteres |
| `currency` | enum | si (al crear) | `ARS`, `USD`, `EUR`. Inmutable luego de creada |
| `accountId` | string | si | debe ser una cuenta propia |
| `type` (transaction) | enum | si | `income`, `expense` (no `transfer`: usar `/transfers`) |
| `amount` | number | si | mínimo `0.01` |
| `category` | enum | no | ver lista en `/categories` |
| `description` | string | no | máx 500 caracteres |
| `email` | string (email) | si | - |
| `password` | string | si | - |

---

## Errores comunes

| Status | Significado |
|--------|-------------|
| 400 | Validación fallida (ver `errors`), o se intenta editar una transferencia |
| 401 | No autenticado o token inválido |
| 404 | Recurso no encontrado o no pertenece al usuario autenticado |
| 422 | Transferencia rechazada por fondos insuficientes |
