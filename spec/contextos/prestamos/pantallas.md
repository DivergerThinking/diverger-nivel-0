# Pantallas del contexto «Préstamos»

Las pantallas de este contexto, que la aplicación enseña en `web/prestamos/`. Cada pantalla es una sección con estos campos, en este orden:

## Equipos y préstamos

- **Id:** `prestamos-lista`
- **Quién la ve:** cualquier persona con la sesión iniciada. Por ahora no se limita a las cuentas de IT.
- **Historias:** HU-EQU-02, HU-ACC-01
- **Operaciones:** `prestamos.listarEquipos` (`GET /api/equipos`)
- **Qué enseña:** todos los equipos con su nombre y si están prestados; de los prestados, la persona y la fecha de devolución.
- **Qué hace la persona:** la consulta. Sin sesión iniciada, entra con su cuenta de Google y ve «Inicia sesión con Google.» hasta que lo hace.

## Apuntar un préstamo

- **Id:** `prestamos-prestar`
- **Quién la ve:** cualquier persona con la sesión iniciada. Por ahora no se limita a las cuentas de IT.
- **Historias:** HU-PRE-01, HU-PRE-03
- **Operaciones:** `prestamos.listarEquipos` (`GET /api/equipos`), `prestamos.prestarEquipo` (`POST /api/equipos/{id}/prestamo`)
- **Qué enseña:** los equipos libres, y para el equipo elegido un campo para la persona y otro para la fecha de devolución.
- **Qué hace la persona:** elige un equipo libre, escribe la persona y la fecha en formato AAAA-MM-DD y confirma. Si falta la persona o la fecha ve «Faltan la persona o la fecha de devolución»; si la fecha no es real ve «La fecha de devolución no es válida»; si el equipo ya está prestado ve «El equipo ya está prestado». Una fecha pasada se acepta.

## Apuntar una devolución

- **Id:** `prestamos-devolver`
- **Quién la ve:** cualquier persona con la sesión iniciada. Por ahora no se limita a las cuentas de IT.
- **Historias:** HU-PRE-02
- **Operaciones:** `prestamos.listarEquipos` (`GET /api/equipos`), `prestamos.devolverEquipo` (`POST /api/equipos/{id}/devolucion`)
- **Qué enseña:** los equipos prestados, con la persona y la fecha de devolución.
- **Qué hace la persona:** elige un equipo prestado y apunta su devolución; el equipo pasa a estar libre. Si el equipo no está prestado ve «El equipo no está prestado».
