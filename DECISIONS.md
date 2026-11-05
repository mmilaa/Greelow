# Decisiones

### 1. Transferencias entre monedas distintas
Decidí bloquearlas en una primera etapa. Probé transferir 5000 de una cuenta en ARS a otra en USD y la API lo acreditó sin convertir nada. Prefiero primero no permitirlo y luego aceptarlas aplicando una conversión.

### 2. Estados asincrónicos (pending -> completed)


### 3. Fondos insuficientes


## Otras decisiones

### Transferencias a cuentas de otro usuario
La API no permite consultar la moneda de una cuenta ajena y tampoco revierte transferencias. Si las monedas difieren, el dinero se crea y no hay vuelta atrás. Descarté mandar una transferencia de 0.01 para descubrir la moneda (es irreversible y involucra a un tercero) y descarté advertir al usuario, porque tampoco puede saberlo. Decidí permitir transferencias solo entre cuentas propias, donde la moneda siempre es conocida. La solución de fondo es del backend: rechazar monedas distintas o exponer la moneda del destino.

### Manejo del dinero
Se guardan los montos como enteros en la unidad mínima (centavos) y no como decimales porque con número de punto flotante las sumas y comparaciones no son exactas y acá estas comparaciones deciden si una transferencia se hace o no.

### Decimales en montos
Los montos que ingresa el usuario no se redondean, se limitan los decimales que puede ingresar a 2. Esto es porque un número en JavaScript no puede representar exactamente valores como 1.005. Los montos de la API ya vienen con 2 decimales como máximo, y `Money.fromDecimal` redondea solo como defensa.

### Angular Material
Usé Angular Material para los componentes de UI (formularios, tabla, paginador, mensajes). No es lo que se evalúa en la prueba, así que prefiero invertir el tiempo en el dominio y en los estados de las operaciones, y de paso obtengo accesibilidad básica sin escribirla. Lo restringí a la capa de UI para que la lógica de negocio no dependa de ninguna librería de componentes.

### Arquitectura
### Signals 
### TypeScript estricto
### Tradeoffs / lo que no implementé y por qué