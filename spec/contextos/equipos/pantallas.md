# Pantallas del contexto «Equipos»

## Alta de equipo

- **Id:** `equipos-alta`
- **Quién la ve:** cualquier persona con la sesión iniciada.
- **Historias:** HU-EQU-01
- **Operaciones:** `equipos.crearEquipo` (`POST /api/equipos`)
- **Qué enseña:** un formulario con el `nombre` del equipo y, tras el alta, el equipo creado con su `nombre` y sin prestar.
- **Qué hace la persona:** escribe el nombre y da de alta el equipo. Si falta el nombre ve «Falta el nombre del equipo»; si ya existe ve «Ya hay un equipo con ese nombre».
