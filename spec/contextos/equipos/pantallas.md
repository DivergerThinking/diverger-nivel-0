# Pantallas del contexto «Equipos»

## Alta de equipo

- **Id:** `equipos-alta`
- **Quién la ve:** cualquier persona con la sesión iniciada.
- **Historias:** HU-INV-01, HU-ACC-01
- **Operaciones:** `equipos.crearEquipo` (`POST /api/equipos`)
- **Qué enseña:** un formulario con un campo, el `nombre` del equipo, y, tras dar de alta, el `nombre` del equipo creado como no prestado.
- **Qué hace la persona:** escribe el nombre y da de alta el equipo. Si falla, ve el mensaje del contrato: «Falta el nombre del equipo», «Ya hay un equipo con ese nombre» o «Inicia sesión con Google.».
