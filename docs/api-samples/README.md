# API samples

Respuestas crudas del mock-api, capturadas con PowerShell sobre el seed original
(`npm run seed`) el 2026-11-04. Los IDs con timestamp cambian en cada corrida.

| Archivo | Qué muestra |
|---|---|
| 04-transfer-cross-currency | Transferencia ARS -> USD: mismo `amount` en ambos lados, sin conversión |
| 05-balance-timing | El saldo no cambia en `pending`; baja al pasar a `completed` |
| 06-race-condition | Dos transferencias rápidas superan el saldo: la API permite sobregiro |
| 07/08/09 | Formas de error 400, 422 y 401 (el 400 y el 422 tienen cuerpos distintos) |
| 10-transaction-decimal | La API acepta montos con decimales |