# Glosario

El lenguaje de la aplicación de préstamo de equipos de la oficina. Los nombres de la última columna son los que usan el código, los tests y las tareas.

| Término | Definición | Contexto | En el código |
|---|---|---|---|
| Equipo | Un objeto de la oficina que IT puede prestar, como «Portátil 07» o «Proyector sala 2». Tiene un identificador y un nombre. | equipos | `Equipment` |
| Nombre del equipo | El texto con el que IT llama a un equipo. No puede estar vacío ni repetirse. | equipos | `EquipmentName` |
| Clave del nombre | El nombre sin espacios al principio ni al final y en minúsculas. Dos nombres son el mismo si tienen la misma clave. | equipos | `NameKey` |
| Préstamo activo | El préstamo de un equipo que todavía no se ha devuelto: guarda el prestatario y la fecha de devolución. Un equipo tiene como mucho uno. | prestamos | `ActiveLoan` |
| Prestatario | La persona a quien se presta un equipo. En la API es el campo `persona`. | prestamos | `Borrower` |
| Fecha de devolución | El día en que el prestatario tiene que devolver el equipo, como texto AAAA-MM-DD. Tiene que existir; puede ser una fecha pasada. | prestamos | `DueDate` |
| Devolución | El acto de apuntar que un equipo vuelve a estar libre: borra su préstamo activo. | prestamos | `Return` |
| Equipo prestado | Un equipo que tiene un préstamo activo. En la API es `prestado: true`. | prestamos | `LentEquipment` |
