# Pantallas del contexto «Equipos»

## Alta de equipo

- **Id:** `equipos-alta`
- **Quién la ve:** cualquier persona con la sesión iniciada.
- **Historias:** HU-EQU-01, HU-EQU-02
- **Operaciones:** `equipos.crearEquipo` (`POST /api/equipos`)
- **Qué enseña:** un formulario con el `nombre` del equipo y, tras el alta, el equipo creado con su `nombre` como no prestado.
- **Qué hace la persona:** escribe el nombre y da de alta el equipo. Si el nombre falta o está vacío ve «Falta el nombre del equipo»; si ya hay un equipo con ese nombre, aunque cambien las mayúsculas o los espacios del principio o del final, ve «Ya hay un equipo con ese nombre».
