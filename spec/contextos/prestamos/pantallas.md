# Pantallas del contexto «Préstamos»

## Equipos y préstamos

- **Id:** `prestamos-lista`
- **Quién la ve:** cualquier persona con la sesión iniciada. Es la primera pantalla al entrar con la cuenta de Google; sin sesión, la aplicación enseña «Inicia sesión con Google.» y ningún equipo.
- **Historias:** HU-EQU-03, HU-PRE-03, HU-ACC-01
- **Operaciones:** `prestamos.listarEquipos` (`GET /api/equipos`), `prestamos.devolverEquipo` (`POST /api/equipos/{id}/devolucion`)
- **Qué enseña:** todos los equipos con su `nombre` y si están prestados (`prestado`); de los prestados, también la `persona` y la fecha de devolución (`devolucion`).
- **Qué hace la persona:** consulta la lista y apunta la devolución de un equipo prestado, que pasa a figurar como no prestado, sin persona ni fecha. Si el equipo no está prestado ve «El equipo no está prestado»; si ya no existe, «No existe el equipo».

## Prestar un equipo

- **Id:** `prestamos-prestar`
- **Quién la ve:** cualquier persona con la sesión iniciada.
- **Historias:** HU-PRE-01, HU-PRE-02
- **Operaciones:** `prestamos.listarEquipos` (`GET /api/equipos`), `prestamos.prestarEquipo` (`POST /api/equipos/{id}/prestamo`)
- **Qué enseña:** el equipo elegido, con su `nombre`, y un formulario con la `persona` y la fecha de devolución (`devolucion`).
- **Qué hace la persona:** escribe la persona y la fecha de devolución y apunta el préstamo; el equipo pasa a figurar como prestado a esa persona hasta esa fecha. Si falta la persona o la fecha ve «Faltan la persona o la fecha de devolución»; si la fecha no existe, «La fecha de devolución no es válida»; si el equipo ya está prestado, «El equipo ya está prestado»; si no existe, «No existe el equipo».
