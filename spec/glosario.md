# Glosario

| Término | Definición | Contexto | En el código |
|---|---|---|---|
| Equipo | Un aparato de la oficina que se puede prestar, como «Portátil 07» o «Proyector sala 2». Tiene un id y un nombre. | equipos | `Equipment` |
| Nombre normalizado | El nombre de un equipo sin espacios al principio ni al final y en minúsculas. Dos equipos con el mismo nombre normalizado tienen el mismo nombre. | equipos | `normalizedName` |
| Préstamo activo | El préstamo en curso de un equipo: a qué persona y con qué fecha de devolución. Un equipo tiene como mucho uno. | prestamos | `ActiveLoan` |
| Persona | Quien tiene prestado un equipo, como texto libre con su nombre. | prestamos | `borrower` |
| Fecha de devolución | El día en que la persona tiene que devolver el equipo, como texto `AAAA-MM-DD`. | prestamos | `returnDate` |
| Devolución | El momento en que IT recibe el equipo de vuelta; el equipo deja de estar prestado. | prestamos | `Return` |
| Equipo con su préstamo | Un equipo con su estado: prestado o no y, si lo está, la persona y la fecha de devolución. | prestamos | `EquipmentWithLoan` |
| Técnico de IT | La persona del equipo de IT que usa las pantallas con su cuenta de Google. | equipos, prestamos | `ItTechnician` |
| Inventario de IT | El sistema que llama a la API con una cuenta de servicio. | prestamos | `ItInventory` |
