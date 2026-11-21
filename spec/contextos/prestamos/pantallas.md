# Pantallas del contexto «Préstamos»

## Equipos y préstamos

- **Id:** `prestamos-equipos`
- **Quién la ve:** cualquier persona con la sesión iniciada.
- **Historias:** HU-INV-02, HU-PRE-01, HU-PRE-02, HU-PRE-03, HU-ACC-01
- **Operaciones:** `prestamos.listarEquipos` (`GET /api/equipos`), `prestamos.prestarEquipo` (`POST /api/equipos/{id}/prestamo`), `prestamos.devolverEquipo` (`POST /api/equipos/{id}/devolucion`)
- **Qué enseña:** la lista de equipos, cada uno con su `nombre` y si está `prestado`; si lo está, la `persona` y la `devolucion`. Sin equipos, la lista vacía. En cada equipo sin prestar, un formulario con dos campos, `persona` y `devolucion`.
- **Qué hace la persona:** en un equipo sin prestar, escribe la persona y la fecha de devolución y apunta el préstamo, sin salir de la lista; en un equipo prestado, apunta la devolución. Tras cada acción ve la lista al día. Si falla, ve el mensaje del contrato: «Faltan la persona o la fecha de devolución», «La fecha de devolución no es válida», «No existe el equipo», «El equipo ya está prestado», «El equipo no está prestado» o «Inicia sesión con Google.».
