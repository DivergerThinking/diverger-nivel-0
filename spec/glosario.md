# Glosario

| Término | Definición | Contexto | En el código |
|---|---|---|---|
| Equipo | Aparato de la oficina que IT puede prestar, con un id que genera la aplicación y un nombre que no se repite. | equipos | `Equipo` |
| Nombre de equipo | Texto con el que IT llama a un equipo; se guarda como se escribió. | equipos | `nombre` |
| Nombre normalizado | El nombre de equipo sin espacios al principio ni al final y en minúsculas; dos equipos no pueden tener el mismo. | equipos | `nombreNormalizado` |
| Préstamo activo | Lo que dice que un equipo está prestado ahora: a qué persona y con qué fecha de devolución. Un equipo tiene como mucho uno. | prestamos | `PrestamoActivo` |
| Persona | Nombre de quien tiene prestado el equipo, como texto. | prestamos | `persona` |
| Fecha de devolución | Día en que la persona tiene que devolver el equipo, como texto AAAA-MM-DD. | prestamos | `devolucion` |
| Prestado | Si el equipo tiene un préstamo activo. | prestamos | `prestado` |
| Devolución | Acto de apuntar que un equipo prestado ha vuelto; borra su préstamo activo. | prestamos | `devolverEquipo` |
| Equipo con su préstamo | Un equipo junto con si está prestado y, si lo está, la persona y la fecha de devolución. | prestamos | `EquipoConPrestamo` |
