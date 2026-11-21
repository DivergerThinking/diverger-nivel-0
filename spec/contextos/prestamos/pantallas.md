# Pantallas del contexto «Préstamos»

## Equipos y préstamos

- **Id:** `prestamos-equipos`
- **Quién la ve:** cualquier persona con la sesión iniciada.
- **Historias:** HU-EQU-03, HU-PRE-01, HU-PRE-02, HU-PRE-03
- **Operaciones:** `prestamos.listarEquipos` (`GET /api/equipos`), `prestamos.prestarEquipo` (`POST /api/equipos/{id}/prestamo`), `prestamos.devolverEquipo` (`POST /api/equipos/{id}/devolucion`)
- **Qué enseña:** la lista de equipos con su `nombre` y si está prestado; de los prestados, la `persona` y la fecha de `devolucion`. Sin sesión enseña «Inicia sesión con Google.» y ningún equipo.
- **Qué hace la persona:** en un equipo sin prestar, escribe la persona y la fecha de devolución y apunta el préstamo; en un equipo prestado, apunta la devolución. La lista se actualiza con la respuesta. Si falla ve el mensaje del contrato: «Faltan la persona o la fecha de devolución», «La fecha de devolución no es válida», «No existe el equipo», «El equipo ya está prestado» o «El equipo no está prestado».
