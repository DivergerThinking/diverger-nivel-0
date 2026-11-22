# Pantallas del contexto «Equipos»

Las pantallas de este contexto, que la aplicación enseña en `web/equipos/`. Cada pantalla es una sección con estos campos, en este orden:

## Alta de equipo

- **Id:** `equipos-alta`
- **Quién la ve:** cualquier persona con la sesión iniciada. Por ahora no se limita a las cuentas de IT.
- **Historias:** HU-EQU-01
- **Operaciones:** `equipos.crearEquipo` (`POST /api/equipos`)
- **Qué enseña:** un campo para el nombre del equipo y un botón para darlo de alta; tras el alta, el equipo con su nombre.
- **Qué hace la persona:** escribe el nombre, por ejemplo «Portátil 07», y lo da de alta. Si el nombre está vacío ve «Falta el nombre del equipo»; si ya existe un equipo con ese nombre, aunque sea en minúsculas o con espacios al principio o al final, ve «Ya hay un equipo con ese nombre».
