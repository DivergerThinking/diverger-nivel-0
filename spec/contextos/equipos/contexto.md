# Equipos

## Propósito

Lleva la lista de los equipos de la oficina y el préstamo en curso de cada uno: IT da de alta los equipos, apunta a quién presta cada uno y hasta cuándo, apunta su devolución y ve en todo momento qué está prestado. Su API es la que fija el cliente para el inventario de IT y la que usa la interfaz web de IT.

## Modelo

- **Equipo** (agregado): id, nombre del equipo, nombre normalizado, prestado y, solo cuando está prestado, el préstamo en curso.
- **Préstamo** (objeto de valor dentro del equipo): persona y fecha de devolución.
- **Fecha de devolución** (objeto de valor): texto `AAAA-MM-DD` que corresponde a un día que existe en el calendario; se guarda y se devuelve igual que llega.
- **Nombre normalizado** (objeto de valor): el nombre del equipo sin espacios al principio ni al final y en minúsculas.

La persona que inicia sesión (técnico de IT o inventario de IT) la da el servidor del golden path (`request.persona`); este contexto no la guarda.

## Invariantes

- Todas las rutas exigen un token de identidad de Google válido; sin él, la respuesta es 401 con `{"error": "Inicia sesión con Google."}`. Lo garantiza el servidor del golden path (`app/server.ts`) antes de llegar al contexto.
- Un equipo se da de alta con un nombre no vacío; sin nombre, o con un nombre vacío, la respuesta es 400 «Falta el nombre del equipo».
- No hay dos equipos con el mismo nombre normalizado: « portátil 07 » repite «Portátil 07» y da 409 «Ya hay un equipo con ese nombre». (concurrencia)
- Un equipo recién dado de alta no está prestado.
- Un préstamo necesita persona y fecha de devolución; si falta alguna, 400 «Faltan la persona o la fecha de devolución».
- La fecha de devolución tiene que existir («2026-02-30» no vale): si no, 400 «La fecha de devolución no es válida». Una fecha pasada se acepta.
- Un equipo tiene como mucho un préstamo en curso: prestar uno ya prestado da 409 «El equipo ya está prestado» y no cambia el préstamo en curso. (concurrencia)
- Solo se devuelve un equipo prestado: si no lo está, 409 «El equipo no está prestado».
- Prestar o devolver un equipo que no existe da 404 «No existe el equipo».
- Un equipo libre se lista sin `persona` ni `devolucion`; uno prestado, con las dos.
- Los errores son siempre un objeto JSON `{"error": "<mensaje>"}` con el mensaje exacto de la API fijada por el cliente.

## Persistencia

A través del puerto de persistencia del golden path (`lib/datos.ts`), con colecciones escritas solo por este contexto:

- `equipos_equipos`: un documento por equipo, con el id como clave: `id`, `nombre`, `nombreNormalizado`, `prestado` y, si está prestado, `persona` y `devolucion`.
- `equipos_nombres`: un documento por nombre normalizado, con el nombre normalizado como clave y el `id` del equipo; sirve para garantizar que el nombre es único.

Transacciones:

- Alta: en una transacción, se lee `equipos_nombres/<nombre normalizado>`; si existe, 409; si no, se guardan el documento del nombre y el del equipo.
- Préstamo: en una transacción, se lee el equipo; si no existe, 404; si está prestado, 409; si no, se guarda con `prestado: true`, `persona` y `devolucion`.
- Devolución: en una transacción, se lee el equipo; si no existe, 404; si no está prestado, 409; si no, se guarda con `prestado: false` y sin `persona` ni `devolucion`.
- Listado: `listar` de `equipos_equipos`, sin transacción.

## Dependencias

Ninguna.

## Decisiones

Pendientes de ADR:

- Los caminos y el formato de error del contrato son los de la API fijada por el cliente, no los de las convenciones (prefijo `/api/<id>/` y RFC 9457).
- La unicidad del nombre se garantiza con la colección `equipos_nombres` dentro de una transacción. (concurrencia)
- Prestar y devolver se hacen en una transacción sobre el documento del equipo, para que dos peticiones a la vez no presten dos veces el mismo equipo. (concurrencia)
