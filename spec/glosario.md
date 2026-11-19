# Glosario

| Término | Definición | Contexto | En el código |
|---|---|---|---|
| Equipo | Aparato de la oficina que IT puede prestar, con un id y un nombre | equipos | `Equipment` |
| Nombre | Texto con el que IT da de alta un equipo y lo reconoce | equipos | `name` |
| Nombre normalizado | El nombre sin espacios al principio ni al final y en minúsculas; dos equipos con el mismo nombre normalizado son el mismo | equipos | `normalizedName` |
| Préstamo activo | Lo que dice que un equipo está prestado: a qué persona y con qué fecha de devolución. Un equipo tiene como mucho uno | prestamos | `ActiveLoan` |
| Persona | Nombre de quien tiene prestado el equipo | prestamos | `borrower` |
| Fecha de devolución | Día en que la persona tiene que devolver el equipo, como texto `AAAA-MM-DD` | prestamos | `returnDate` |
| Prestado | Estado de un equipo que tiene un préstamo activo | prestamos | `onLoan` |
| Devolución | Acción de apuntar que la persona ha devuelto el equipo; termina su préstamo activo | prestamos | `returnEquipment` |
| Equipo con préstamo | Un equipo junto con su estado de prestado y, si lo está, la persona y la fecha de devolución | prestamos | `EquipmentWithLoan` |
