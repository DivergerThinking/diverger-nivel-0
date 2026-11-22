# Pantallas del contexto «Préstamos»

## Equipos y préstamos

- **Id:** `prestamos-lista`
- **Quién la ve:** cualquier persona con la sesión iniciada con Google; sin sesión, la aplicación pide iniciarla («Inicia sesión con Google.»).
- **Historias:** HU-ACC-01, HU-EQU-02
- **Operaciones:** `prestamos.listarEquipos` (`GET /api/equipos`)
- **Qué enseña:** todos los equipos con su `nombre` y si están prestados; de los prestados, la `persona` y la fecha de `devolucion`.
- **Qué hace la persona:** entra con su cuenta de Google y consulta qué equipos están prestados, a quién y hasta cuándo.

## Prestar un equipo

- **Id:** `prestamos-prestar`
- **Quién la ve:** cualquier persona con la sesión iniciada.
- **Historias:** HU-PRE-01
- **Operaciones:** `prestamos.listarEquipos` (`GET /api/equipos`), `prestamos.prestarEquipo` (`POST /api/equipos/{id}/prestamo`)
- **Qué enseña:** desde un equipo sin prestar de la lista, un único formulario con la `persona` y la fecha de `devolucion`.
- **Qué hace la persona:** apunta el préstamo en menos de un minuto. Si falta un dato ve «Faltan la persona o la fecha de devolución»; con una fecha que no existe ve «La fecha de devolución no es válida»; si el equipo ya está prestado ve «El equipo ya está prestado»; si el equipo no existe ve «No existe el equipo».

## Apuntar la devolución

- **Id:** `prestamos-devolver`
- **Quién la ve:** cualquier persona con la sesión iniciada.
- **Historias:** HU-PRE-02
- **Operaciones:** `prestamos.listarEquipos` (`GET /api/equipos`), `prestamos.devolverEquipo` (`POST /api/equipos/{id}/devolucion`)
- **Qué enseña:** los equipos prestados de la lista, con la `persona` y la fecha de `devolucion`, y la acción de apuntar la devolución.
- **Qué hace la persona:** apunta la devolución de un equipo prestado, que pasa a no prestado. Si no está prestado ve «El equipo no está prestado»; si no existe ve «No existe el equipo».
