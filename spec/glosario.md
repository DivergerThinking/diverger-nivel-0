# Glosario

| Término | Definición | Contexto | En el código |
|---|---|---|---|
| Equipo | Aparato de la oficina que IT presta, con un nombre único, por ejemplo «Portátil 07». | equipos | `Device` |
| Nombre del equipo | Texto con el que IT identifica un equipo. | equipos | `nombre` |
| Nombre normalizado | El nombre sin espacios al principio ni al final y en minúsculas; dos equipos con el mismo nombre normalizado son el mismo. | equipos | `normalizedName` |
| Préstamo activo | Préstamo de un equipo que todavía no se ha devuelto. Un equipo tiene como mucho uno. | prestamos | `ActiveLoan` |
| Persona | Quien tiene el equipo prestado, como texto libre. | prestamos | `persona` |
| Fecha de devolución | Día en que la persona tiene que devolver el equipo, como texto `AAAA-MM-DD`. | prestamos | `devolucion` |
| Prestado | Si el equipo tiene un préstamo activo. | prestamos | `prestado` |
| Devolución | Acción de IT que termina el préstamo activo de un equipo. | prestamos | `returnDevice` |
