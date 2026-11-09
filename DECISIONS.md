# Decisiones

### 1. Transferencias entre monedas distintas
Decidí bloquearlas en una primera etapa. Probé transferir 5000 de una cuenta en ARS a otra en USD y la API lo acreditó sin convertir nada. Prefiero primero no permitirlo y luego aceptarlas aplicando una conversión.
Evalué la posibilidad de agregar conversión usando una API de cotizaciones, pero no era suficiente porque la API usa el mismo monto para ambas partes de la transferencia. Tampoco servía resolverlo creando dos movimientos por separado, porque no sería una operación atómica y no habría forma de revertirla si algo fallaba. Por eso mantuve el bloqueo y dejé como solución definitiva un cambio en el backend.

### 2. Estados asincrónicos (pending -> completed)

Una transferencia nace en `pending` y la API la liquida sola a `completed` alrededor de un segundo y medio después, sin que nadie vuelva a llamar al endpoint. Lo verifiqué midiendo tiempos: el saldo no cambia mientras está `pending` y recién baja al completarse (`docs/api-samples/05-balance-timing.txt`, y en `44-…` y `45-…` la misma transferencia pendiente y completada).
Decidí seguirla con un polling corto y acotado. Al crearla, la pantalla muestra "Procesando" con un spinner y consulta `GET /transfers/:id` cada 1000 ms, con un máximo de 6 intentos. La primera consulta sale un segundo después de crear, porque el POST ya dice que está pendiente. Como la API liquida en ~1,5 s, la segunda consulta ya la ve completada, y 6 intentos dan margen de sobra sin quedarse consultando para siempre. Si se agotan, muestro "No pudimos confirmar" con un botón "Verificar de nuevo" que hace una consulta más.
Si la consulta en sí falla (error de red o 500), no lo trato como un fallo de la transferencia sino como si siguiera pendiente: reintento si quedan intentos y, si se agotan, "no pudimos confirmar". Solo la marco como fallida si la API dice explícitamente `failed`. Si la sesión expiró (401), corto el seguimiento.
No retomo el seguimiento al volver a la pantalla: si el usuario sale mientras la transferencia está en proceso, se cancelan los temporizadores, pero la transferencia sigue su curso en el servidor y la tarjeta de la cuenta muestra "en proceso" hasta que se liquida. El costo es que en ese caso el resultado no se ve en esta pantalla.

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
Primero una corrección de lo que daba por supuesto: la API **no** limita los decimales. En una prueba aceptó y guardó un gasto de 12.345. Entonces separé la escritura de la lectura:

- **Escritura estricta.** El formulario solo deja ingresar hasta 2 decimales y nunca redondea lo que escribe el usuario: o es válido o se rechaza. Un número de JavaScript no puede representar exactamente valores como 1.005, así que redondear un monto tipeado me obligaría a adivinar su intención.
- **El monto es un campo de texto**, no `type="number"` (que acepta cosas como `1e3`, cambia el valor con la rueda del mouse y depende de la configuración regional). Acepta dígitos con una coma o un punto y 1 o 2 decimales. No acepta separador de miles: `1.234` y `1.234,56` se rechazan en lugar de adivinar si el punto es de miles o decimal, y el mensaje lo explica. Los centavos se arman con enteros a partir de los dígitos, sin pasar por números de punto flotante.
- **Lectura tolerante.** Lo que venga de la API con más de 2 decimales se redondea al centavo más cercano al leerlo. No lo rechazo, porque un solo registro así, que cualquier otro cliente puede crear, dejaría esa cuenta inutilizable.

El costo es que puede haber un centavo de diferencia entre la suma de lo que muestro y el saldo: en la prueba, 855000 − 12,35 + 10 da 854997,65 y la API muestra 854997,66.

La cantidad de decimales no está hardcodeada: vive en un mapa por moneda en `Currency` (hoy ARS, USD y EUR usan 2), así que si entrara una moneda con otra escala el factor sale de ahí. Las entradas inválidas (NaN, Infinity o fuera del rango entero seguro) se rechazan con un error de dominio (`InvalidAmountError`) en vez de propagar valores corruptos.


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

### 25. Detalle de cuenta: carga y estados
Separé la carga de la cuenta y la de sus movimientos para que un error en estos últimos no oculte los datos de la cuenta. También cuidé que al entrar al detalle no se disparen cargas duplicadas.

### 26. Filtros de movimientos: selección única, sin multi-valor
Dejé cada filtro como selección única. Probé qué hace la API cuando se repite un parámetro (`type=expense&type=income`) y da error. Combinar filtros distintos sí es lo que el README declara (cuenta, tipo, estado, categoría y búsqueda a la vez), y la pantalla lo hace; lo que no soporta es más de un valor para el mismo filtro.

Descarté la selección múltiple porque la API no la admite. Para ofrecerla tendría que hacer una consulta por cada valor y unir los resultados, o leer todo el historial y filtrar en el cliente. En ambos casos la paginación, el total y la cantidad de páginas dejarían de salir del servidor, que es lo que más quería mantener confiable. El costo es que no se pueden ver, por ejemplo, gastos y transferencias a la vez sin dejar el filtro de tipo en "Todos". Tampoco hay filtro por fecha, porque la API no lo ofrece.

### 27. Diálogo de registrar movimiento: launcher desacoplado y carga diferida
Desacoplé el detalle de cuentas de la feature de movimientos usando un launcher compartido, sin importar directamente el diálogo. También dejé la implementación con lazy loading para no sumar Material y el diálogo al bundle inicial. El launcher evita aperturas duplicadas y permite reintentar si falla la carga.

### 28. Lectura fresca antes de validar una transferencia
Hago una lectura nueva de pendientes y cuentas antes de validar, para no usar un saldo desactualizado. También agregué un control para detectar si otra lectura más reciente la pisa: en ese caso reintenta una vez y, si no logra obtener datos actualizados, bloquea la transferencia. Así evito validar con un disponible anterior y habilitar un posible sobregiro.

### 29. Pantalla de transferencias: componentes que no se destruyen y motivos visibles
Separé el formulario y el panel de estado para mantener la lógica fuera de los componentes. Decidí no destruir el formulario durante el proceso para conservar lo que el usuario ingresó y permitir reintentar sin empezar de cero. También agregué los motivos por los que ciertos destinos no se pueden seleccionar, incluyendo una explicación accesible debajo del campo.

### 30. Un gasto puede dejar la cuenta en negativo
Probé registrar un gasto mayor al saldo disponible y la API lo aceptó, dejando la cuenta en negativo. Decidí permitirlo porque registrar un gasto es dejar constancia de algo que ya ocurrió, no realizar un pago.

En ese caso muestro un aviso, pero no bloqueo el registro. El mensaje aclara que la cuenta quedará en negativo y no se podrán hacer transferencias desde ella hasta cubrir el saldo. El aviso se calcula sobre el saldo disponible y solo se muestra si ese dato se conoce.

### 31. Orden de lectura: pendientes primero, saldo después
Para calcular el saldo disponible necesito consultar las transferencias pendientes y después las cuentas. Hago las consultas en secuencia y no en paralelo. Lo decidí así para evitar que una transferencia que se complete entre ambas consultas termine sin descontarse del disponible, lo que podría permitir un sobregiro. Prefiero que, en ese caso, el disponible quede momentáneamente por debajo del real antes que por encima.
El costo es que durante un instante el usuario puede ver menos saldo disponible del que realmente tiene.

### 32. Los pendientes se leen con una consulta propia
Evalué usar los últimos movimientos para obtener las transferencias pendientes y ahorrar una consulta, pero no era seguro: la API no garantiza un orden y podría haber pendientes que no aparezcan entre los últimos 5.
Tampoco conviene recorrer todo el historial porque la cantidad de consultas crecería con los movimientos. Por eso decidí pedir todas las transferencias con status=pending&type=transfer, paginando hasta un máximo de 20 páginas (1000 pendientes).
Si se supera ese límite o falla alguna página, descarto la lista parcial y muestro solo el saldo contable con un aviso, para no calcular un disponible incorrecto.
El costo es hacer dos consultas a /transactions al entrar al detalle de una cuenta. Como se hacen en momentos distintos, los resultados pueden tener una pequeña diferencia si una transferencia se liquida entre ambas.

### 33. Si no se puede calcular el disponible, no se transfiere
Cuando falla la lectura de pendientes o de cuentas, el disponible es desconocido. Decidí no permitir la transferencia, con un mensaje claro y un botón para reintentar la lectura, porque permitirla reabriría el sobregiro que encontré. El costo es que una falla de lectura bloquea al usuario aunque su saldo alcance.

### 34. Orden de los últimos movimientos (supuesto)
En el detalle muestro los 5 últimos tomando los primeros que devuelve la API, sin reordenar, porque en el seed vienen del más nuevo al más viejo. El README no promete ese orden: es un supuesto que verifiqué en el seed y no una garantía. Reordenar en el cliente solo ordenaría la página que pedí, así que tampoco lo arreglaría si la API cambiara.

### 35. Dinero en pantalla: código de moneda siempre visible
Muestro el código de moneda delante del monto (`ARS 1.234,56`; negativo, `-ARS 1.234,56`) en lugar del símbolo. Con el formato es-AR, los pesos usan `$`, los dólares `US$` y los euros `EUR`: tres criterios distintos, y en una billetera con varias monedas un `$` ambiguo es un riesgo. El negativo lleva signo y no depende solo del color, y los montos no se parten en dos líneas. El formato vive en el dominio (`formatMoney`) para no decidirlo en cada pantalla. Se ve menos amigable que un símbolo, y lo acepto.

### 36. Colores y accesibilidad
Los colores salen de tokens nombrados por función (superficie, texto, positivo, negativo) en un único archivo, conectados con el tema de Material, así que se puede cambiar el aspecto (por ejemplo, agregar un tema oscuro) sin tocar componentes. La paleta que elegí no tenía colores para el dinero, así que agregué verde, rojo y ámbar para positivo, negativo y advertencia. Verifiqué el contraste (WCAG AA) con un script (`tools/contrast.mjs`) que lee los tokens, en lugar de confiar en estimaciones, y ajusté el verde para ganar margen sobre su fondo.


### 37. Tradeoffs / lo que no implementé y por qué
1. No implementé edición de cuentas: la moneda es inmutable y el nombre no se puede editar por ahora; quedaría como mejora futura.
2. El saldo disponible solo protege a quien usa esta app; el sobregiro provocado desde afuera o por condiciones de carrera no se puede evitar desde el cliente. La solución de fondo es del backend.