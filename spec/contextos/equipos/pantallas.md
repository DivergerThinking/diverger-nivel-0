# Pantallas del contexto «Equipos»

## Alta de equipos

- **Id:** `equipos-alta`
- **Quién la ve:** cualquier persona con la sesión iniciada.
- **Historias:** HU-ACC-01, HU-EQU-01, HU-EQU-02
- **Operaciones:** `equipos.crearEquipo` (`POST /api/equipos`)
- **Qué enseña:** un formulario con el nombre del equipo y, debajo, los equipos dados de alta desde que se abrió la pantalla, cada uno con su `nombre` y como no prestado.
- **Qué hace la persona:** escribe el nombre y da de alta el equipo. Si el nombre está vacío ve «Falta el nombre del equipo»; si repite el de otro equipo ve «Ya hay un equipo con ese nombre»; sin sesión ve «Inicia sesión con Google.».
