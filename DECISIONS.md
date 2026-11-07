# Decisiones

### 1. Transferencias entre monedas distintas
Decidí bloquearlas en una primera etapa. Probé transferir 5000 de una cuenta en ARS a otra en USD y la API lo acreditó sin convertir nada. Prefiero primero no permitirlo y luego aceptarlas aplicando una conversión.

### 2. Estados asincrónicos (pending -> completed)
Al crear una transferencia nace en `pending` y la API la liquida sola a `completed` alrededor de un segundo y medio después, sin que nadie vuelva a llamar al endpoint. Lo verifiqué midiendo tiempos (`docs/api-samples/05-balance-timing.txt`): el saldo no cambia mientras está `pending` y recién baja al pasar a `completed`. Decidí mostrar un badge "Procesando" y hacer un polling corto y acotado: consulto cada 1000 ms, con un máximo de 6 intentos, más un refresco al volver a la pantalla. Elegí esos valores porque la API liquida en ~1,5 s, así que 6 intentos dan margen de sobra sin colgarse. Nunca polling infinito: si se agotan los intentos, muestro "no pudimos confirmar" con una acción para refrescar.
Si la consulta en sí falla (error de red o 500), eso no es un fallo de la transferencia: lo trato como si siguiera `pending` (reintento si quedan intentos, "no pudimos confirmar" si se agotan), nunca como `failed`. Solo marco una transferencia como fallida si la API dice explícitamente `failed`.

### 3. Fondos insuficientes
Decidí validar antes de enviar contra el saldo disponible (no el contable) y, de todas formas, manejar el 422 que devuelve la API (`docs/api-samples/08-error-422.txt`). La validación del cliente es la única defensa real contra el sobregiro, pero no reemplaza al 422 porque hay condiciones de carrera que el cliente no ve. Por eso también bloqueo el envío mientras haya una transferencia en vuelo desde esa cuenta.

### 4. Transferencias a cuentas de otro usuario
La API no permite consultar la moneda de una cuenta ajena y tampoco revierte transferencias. Si las monedas difieren, el dinero se crea y no hay vuelta atrás. Descarté mandar una transferencia de 0.01 para descubrir la moneda (es irreversible y involucra a un tercero) y descarté advertir al usuario, porque tampoco puede saberlo. Decidí permitir transferencias solo entre cuentas propias, donde la moneda siempre es conocida. Por eso el destino se elige de una lista de las cuentas del propio usuario, no se ingresa un ID a mano. La solución de fondo es del backend: rechazar monedas distintas o exponer la moneda del destino.

### 5. Saldo contable y saldo disponible
El saldo contable es el `balance` que devuelve la API. El saldo disponible lo calculo yo en el cliente como contable menos la suma de las transferencias salientes en `pending` de esa cuenta. Las entrantes, las `completed` y las `failed` no restan. Tomé esta decisión porque probé dos transferencias rápidas que juntas superaban el saldo y la API aceptó ambas, dejando la cuenta en negativo (`docs/api-samples/06-race-condition.txt`): el saldo no baja mientras la transferencia está `pending`, así que si valido solo contra el contable permito sobregiros. Validar contra el disponible protege a quien usa esta app, aunque no evita el sobregiro provocado desde afuera.

### 6. Representar el estado `failed`
Decidí representar el estado `failed` en la UI aunque el seed no lo genere, porque el README lo menciona como estado posible y el filtro lo acepta. Prefiero que la interfaz lo contemple antes que asumir que nunca va a aparecer.

### 7. Soportar saldo negativo
La cuenta puede quedar en saldo negativo (lo vi en la condición de carrera). Decidí que la UI lo soporte sin romperse y lo muestre como negativo, en lugar de ocultarlo o tratarlo como cero.

### 8. Manejo del dinero
Se guardan los montos como enteros en la unidad mínima (centavos) y no como decimales porque con número de punto flotante las sumas y comparaciones no son exactas, y acá estas comparaciones deciden si una transferencia se hace o no. La aritmética (sumar, restar, comparar) solo se permite entre la misma moneda; mezclar monedas es un error de dominio.

### 9. Decimales en montos
Los montos que ingresa el usuario no se redondean: limito a 2 los decimales que puede ingresar. Esto es porque un número en JavaScript no puede representar exactamente valores como 1.005. Los montos de la API ya vienen con 2 decimales como máximo, y `Money.fromDecimal` redondea solo como defensa. La cantidad de decimales no está hardcodeada: vive en un mapa por moneda en `Currency` (hoy ARS, USD y EUR usan 2), así que si entra una moneda con otra escala el factor de conversión sale de ahí. Las entradas inválidas (NaN, Infinity, no enteros en centavos o fuera del rango entero seguro) se rechazan con un error de dominio (`InvalidAmountError`) en vez de propagar valores corruptos.

### 10. Angular Material
Usé Angular Material para los componentes de UI (formularios, tabla, paginador, mensajes). No es lo que se evalúa en la prueba, así que prefiero invertir el tiempo en el dominio y en los estados de las operaciones, y de paso obtengo accesibilidad básica sin escribirla. Lo restringí a la capa de UI para que la lógica de negocio no dependa de ninguna librería de componentes.

### 11. TDD
Apliqué TDD para Money y transfer-policy porque son los que consideré que aplicaban mejor, el resto de los test van junto con la implementación.

### 12. Formularios
Para los formularios elegí Reactive Forms en vez de Signal Forms. Reactive Forms es la opción más madura y documentada para validación y testing, y me daba menos sorpresas que una API más nueva. La validación de negocio (montos, moneda, fondos) vive igual en el dominio; el formulario solo valida forma y dispara las acciones.

### 13. Arquitectura
Elegí una arquitectura por features con cuatro capas (domain, application, infrastructure, ui) y dependencias hacia adentro. Al principio me pareció algo pesada para un proyecto chico, pero decidí mantenerla para que la lógica de negocio no dependa de Angular ni de cómo se consumen los datos de la API, y se pueda probar de forma independiente. El dominio compartido (`Money`, `Currency`, errores) vive en `shared/domain` y no importa de ninguna feature; las features sí pueden importar de `shared`.

### 14. Signals
Uso signals para el estado de la aplicación (stores en la capa de application) y `ChangeDetectionStrategy.OnPush` en los componentes. La idea es que el estado sea explícito y la detección de cambios predecible, sin depender de mutaciones implícitas.

### 15. TypeScript estricto
Trabajo con TypeScript en modo estricto y con `strictTemplates`. Modelo los estados y las razones de bloqueo como uniones de tipos literales para que el compilador obligue a cubrir todos los casos (por ejemplo, las razones por las que una transferencia se bloquea), en vez de confiar en strings sueltos.

### 16. CORS
Probé las llamadas a la API directamente desde el navegador y no hubo problemas de CORS, así que no hace falta configurar un proxy en `ng serve`. No toqué el mock-api.

### 17. Mapeo central de errores de la API
Centralicé el manejo de errores para traducir las respuestas de la API a errores tipados, teniendo en cuenta el status, el formato del body y el contexto de la operación. Evité depender del texto que devuelve la API para no mostrar mensajes en inglés al usuario.

También separé la clasificación de errores de los efectos del interceptor y de los mensajes que se muestran en la UI. Me pareció importante mantener esa lógica en un único lugar y que no dependa de Angular.

### 18. DTOs y mappers de la API
Separé los DTOs de los tipos de dominio y agregué mappers para convertir entre ambos. Los montos se transforman a Money al recibirlos y vuelven a decimal al enviarlos.

También definí qué hacer con los datos inválidos: si afectan información importante como montos, moneda o estado, el mapper lanza un error en vez de descartar el registro. Los datos opcionales, como la descripción o categoría, se normalizan. Además, dejé en shared los tipos que usan varias features y calculé totalPages, ya que la API no lo devuelve.

Unifiqué el nombre: la entidad de dominio, el DTO y el mapper se llaman todos "transaction", igual que el recurso en la API, para no mezclar vocabulario.

### 19. Puertos y adaptadores HTTP

Separé los contratos de acceso a datos de su implementación HTTP. Los puertos viven en application y los adaptadores en infrastructure, así la lógica de la aplicación no depende de Angular ni de HttpClient.

También decidí usar `Promise` en los puertos, uso signals en los stores y no quería arrastrar RxJS a todos lados; RxJS queda confinado al adaptador, que resuelve el Observable de HttpClient en el borde. También centralizar el manejo de errores en los adaptadores. Para calcular el saldo disponible, el adaptador obtiene todas las páginas de transferencias pendientes, evitando trabajar con información incompleta. La regla de cálculo sigue estando en el dominio.

### 20. Autenticación y sesión
El token se guarda en sessionStorage, pero lo abstraje para que la aplicación no dependa directamente del navegador. El store maneja los estados de sesión y valida el token al recargar mediante /auth/me.

También separé el comportamiento de los errores 401 según la operación: en el login son credenciales incorrectas y en el resto de las requests significa que la sesión expiró. El interceptor agrega el token solo a las requests de la API.

Por último, agregué la validación del returnUrl para evitar redirecciones externas después del login.

### 21. Base de la UI (rutas, shell y login)
Organicé las rutas privadas dentro de un shell con navegación, menú de usuario y logout. Las páginas se cargan lazy y los componentes solo muestran información y ejecutan acciones del store.

Implementé el login con formularios reactivos y manejo de errores según el tipo. También separé la lógica de redirección del store para evitar dependencias con el Router y distinguir entre una sesión expirada y un logout voluntario.

### 22. Base visual (tema, tokens y componentes compartidos)
Definí tokens CSS para centralizar los colores, espacios y medidas, y los conecté con el tema de Material para poder cambiar el tema sin modificar los componentes. También agregué un script para verificar el contraste.

Creé los componentes compartidos que se van a reutilizar en las pantallas (montos, estados, carga, error y vacío), junto con algunos ajustes de accesibilidad.

### 23. Fechas estrictas y signo del movimiento
Centralicé en el dominio la lógica del signo de los movimientos y el formato de fechas para no repetirla en los componentes. También decidí validar las fechas de forma estricta: deben tener zona horaria y ser fechas reales, para evitar ambigüedades o que se acepten fechas inválidas.

### 24. Nombres de cuenta repetidos
Permito nombres repetidos porque cada cuenta tiene un id que la identifica y que se muestra donde se elige una cuenta. No valido unicidad en el cliente: la lista local puede estar desactualizada y la validación daría una falsa garantía. El costo es que dos cuentas con el mismo nombre solo se distinguen por su id, que es largo.

### 25. Tradeoffs / lo que no implementé y por qué
1. No implementé la conversión de monedas en las transferencias entre monedas distintas: por ahora las bloqueo. La conversión quedaría como mejora futura.
2. No implementé edición de cuentas: la moneda es inmutable y el nombre no se puede editar por ahora; quedaría como mejora futura.
3. El saldo disponible solo protege a quien usa esta app; el sobregiro provocado desde afuera o por condiciones de carrera no se puede evitar desde el cliente. La solución de fondo es del backend.
