# Equipos

## Propósito

Lleva la lista de los equipos de la oficina y el préstamo de cada uno: el alta de un equipo, su préstamo a una persona hasta una fecha de devolución, su devolución y la consulta de qué está prestado, a quién y hasta cuándo. Expone exactamente la API que fijó el cliente para el inventario de IT, y solo responde a llamadas con un token de identidad válido.

## Modelo

- **Equipo** (agregado): `id`, nombre del equipo, `prestado` y, mientras está prestado, el préstamo.
- **Nombre del equipo** (objeto valor): texto no vacío; su forma normalizada (sin los espacios del principio y del final y sin distinguir mayúsculas) es la que se compara para detectar repetidos. Se devuelve tal como se dio de alta.
- **Préstamo** (objeto valor dentro del equipo): persona y fecha de devolución. Un equipo tiene como mucho un préstamo a la vez.
- **Fecha de devolución** (objeto valor): texto AAAA-MM-DD de una fecha real; se guarda y se devuelve con el mismo texto. Las fechas pasadas se aceptan.
- **Token de identidad**: lo verifica la pieza transversal de inicio de sesión (`lib/auth.ts`) antes de llegar al contexto; el contexto no guarda nada de él.

## Invariantes

- Un equipo se da de alta solo con un nombre no vacío; si falta o está vacío, 400 «Falta el nombre del equipo» y no se crea nada.
- No hay dos equipos con el mismo nombre del equipo normalizado; el segundo recibe 409 «Ya hay un equipo con ese nombre». (concurrencia)
- Un equipo nuevo está no prestado.
- Un préstamo necesita persona y fecha de devolución; si falta alguna, 400 «Faltan la persona o la fecha de devolución».
- Una fecha de devolución que no sea real o no siga AAAA-MM-DD recibe 400 «La fecha de devolución no es válida» y el equipo no cambia.
- Solo se presta un equipo no prestado; si ya lo está, 409 «El equipo ya está prestado» y el préstamo anterior no cambia. (concurrencia)
- Solo se devuelve un equipo prestado; si no lo está, 409 «El equipo no está prestado».
- Al devolver un equipo, queda no prestado y la lista de equipos ya no muestra la persona ni la fecha de devolución del préstamo anterior.
- Un id que no existe recibe 404 «No existe el equipo» al prestar o devolver.
- Toda llamada sin un token de identidad válido (sin token, con el correo sin verificar o emitido para otro cliente OAuth) recibe 401 «Inicia sesión con Google.» y no lee ni cambia ningún equipo.

## Persistencia

- Colección `equipos`, escrita solo por este contexto, a través del puerto de persistencia del golden path (`lib/datos.ts`).
- Cada documento es un equipo con su nombre, su nombre normalizado, `prestado` y, si está prestado, `persona` y `devolucion`.
- El alta comprueba el nombre normalizado y crea el equipo en la misma transacción, para que dos altas a la vez con el mismo nombre no dejen dos equipos.
- El préstamo y la devolución leen y cambian el equipo en una transacción, para que dos préstamos a la vez del mismo equipo no se pisen.

## Dependencias

Ninguna.

## Decisiones

Pendientes de ADR:

- Cómo se garantiza el nombre único normalizado con Firestore (transacción frente a documento índice con el nombre normalizado como clave).
- Cómo se evita el doble préstamo a la vez (transacción sobre el documento del equipo).
- La API sigue la que fijó el cliente: rutas exactas del cliente en lugar de `/api/<id>/<recurso>` y errores `{"error": "<mensaje>"}` en lugar de RFC 9457.
