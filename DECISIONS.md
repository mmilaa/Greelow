# Decisiones

### 1. Transferencias entre monedas distintas
Decidí bloquearlas en una primera etapa. Probé transferir 5000 de una cuenta en ARS a otra en USD y la API lo acreditó sin convertir nada. Prefiero primero no permitirlo y luego aceptarlas aplicando una conversión.

### 2. Estados asincrónicos (pending -> completed)


### 3. Fondos insuficientes


## Otras decisiones

### Decimales en montos
Los montos que ingresa el usuario no se redondean, se limitan los decimales que puede ingresar a 2. Esto es porque un número en JavaScript no puede representar exactamente valores como 1.005. Los montos de la API ya vienen con 2 decimales como máximo, y `Money.fromDecimal` redondea solo como defensa.

### Arquitectura
### Signals 
### TypeScript estricto
### Tradeoffs / lo que no implementé y por qué