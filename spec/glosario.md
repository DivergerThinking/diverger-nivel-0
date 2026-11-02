# Glosario

| Término | Definición | Contexto | En el código |
|---|---|---|---|
| Equipo | Objeto físico de la oficina que IT presta, como «Portátil 07» o «Proyector sala 2». Tiene un id y un nombre único. | equipos | `Device` |
| Nombre del equipo | Texto con el que IT identifica un equipo. Dos nombres son el mismo si solo se diferencian en mayúsculas o en espacios al principio o al final. | equipos | `name` |
| Nombre normalizado | El nombre del equipo sin espacios al principio ni al final y en minúsculas; es lo que se compara para saber si un nombre ya existe. | equipos | `normalizedName` |
| Préstamo | Hecho de que un equipo esté en manos de una persona hasta una fecha de devolución. Un equipo tiene como mucho un préstamo en curso. | equipos | `Loan` |
| Prestado | Estado de un equipo con un préstamo en curso. | equipos | `onLoan` |
| Persona | Quien tiene el equipo prestado, escrita como texto libre («Ana Pérez»). | equipos | `borrower` |
| Fecha de devolución | Día en que la persona tiene que devolver el equipo, como texto `AAAA-MM-DD`; tiene que existir y puede ser pasada. | equipos | `dueDate` |
| Devolución | Hecho de apuntar que el equipo ha vuelto: termina el préstamo en curso y el equipo deja de estar prestado. | equipos | `Return` |
| Técnico de IT | Persona del equipo de IT que entra con su cuenta de Google de la empresa y gestiona los equipos y sus préstamos. | equipos | `ItTechnician` |
| Inventario de IT | Sistema de IT que se conecta a la API con una cuenta de servicio de Google. | equipos | `ItInventory` |
| Token de identidad de Google | Token de Google con el correo verificado, emitido para el cliente OAuth de la aplicación, de una persona o de una cuenta de servicio; lo exigen todas las rutas. | equipos | `GoogleIdToken` |
