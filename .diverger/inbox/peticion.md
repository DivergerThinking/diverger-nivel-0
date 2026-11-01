Queremos una lista de los equipos de la oficina donde IT pueda apuntar a quién ha prestado cada uno y cuándo lo devuelve.

Solo la usa el equipo de IT, que entra con su cuenta de Google de la empresa. IT da de alta los equipos (por ejemplo, «Portátil 07» o «Proyector sala 2»), apunta cada préstamo con la persona y la fecha en que lo tiene que devolver, apunta la devolución cuando le devuelven el equipo y ve en todo momento qué equipos están prestados, a quién y hasta cuándo. No hace falta que los empleados pidan nada desde la aplicación, ni avisos de préstamos vencidos.

Hoy lo apuntamos en una hoja de cálculo que nadie mantiene al día: no sabemos qué equipos están prestados ni a quién, y cada pocos meses se pierde alguno o alguien se queda sin portátil porque creíamos que estaba libre. Daremos el proyecto por bueno si durante el primer mes todos los préstamos se apuntan en la aplicación y no se pierde ningún equipo. Lo que más nos preocupa es que IT deje de usarla si apuntar un préstamo cuesta más de un minuto, y que el inventario deje de funcionar si la API cambia.

## Anexo: API para el inventario de IT

El inventario de IT se va a conectar a la aplicación, así que la API tiene que ser exactamente esta. Todas las rutas necesitan haber iniciado sesión: sin un token válido responden 401. Los errores son un objeto JSON `{"error": "<mensaje>"}` con el mensaje exacto que se indica.

| Operación | Petición | Respuesta correcta | Errores |
|---|---|---|---|
| Dar de alta un equipo | `POST /api/equipos` con `{"nombre": "Portátil 07"}` | 201 con `{"id": "…", "nombre": "Portátil 07", "prestado": false}` | 400 «Falta el nombre del equipo» si el nombre falta o está vacío. 409 «Ya hay un equipo con ese nombre» |
| Ver los equipos | `GET /api/equipos` | 200 con la lista de equipos, cada uno con `id`, `nombre` y `prestado`; si está prestado, también `persona` y `devolucion` | — |
| Prestar un equipo | `POST /api/equipos/{id}/prestamo` con `{"persona": "Ana Pérez", "devolucion": "2026-11-20"}` | 201 con el equipo: `id`, `nombre`, `prestado: true`, `persona` y `devolucion` | 400 «Faltan la persona o la fecha de devolución». 404 «No existe el equipo». 409 «El equipo ya está prestado» |
| Apuntar la devolución | `POST /api/equipos/{id}/devolucion` | 200 con el equipo y `prestado: false` | 404 «No existe el equipo». 409 «El equipo no está prestado» |

La fecha de devolución va como texto `AAAA-MM-DD` y se devuelve igual.
