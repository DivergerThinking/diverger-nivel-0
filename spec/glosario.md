# Glosario

| Término | Definición | Contexto | En el código |
|---|---|---|---|
| Equipo | Aparato de la oficina que IT presta, identificado por un nombre único, como «Portátil 07» o «Proyector sala 2». En la API, cada equipo tiene `id`, `nombre` y `prestado`. | equipos | `Equipment` |
| Nombre del equipo | Texto con el que IT identifica un equipo. Dos nombres son el mismo si coinciden sin distinguir mayúsculas y sin los espacios del principio y del final. En la API, `nombre`. | equipos | `EquipmentName` |
| Préstamo | Hecho de que un equipo esté en manos de una persona hasta una fecha de devolución. En la API, `prestado: true` con `persona` y `devolucion`. | equipos | `Loan` |
| Persona | Nombre de quien recibe el equipo prestado, como «Ana Pérez». En la API, `persona`. | equipos | `borrower` |
| Fecha de devolución | Fecha en la que la persona tiene que devolver el equipo, como texto AAAA-MM-DD que se guarda y se devuelve igual. En la API, `devolucion`. | equipos | `dueDate` |
| Devolución | Acto con el que IT apunta que le han devuelto un equipo prestado; el equipo queda no prestado. | equipos | `Return` |
| Técnico de IT | Persona del equipo de IT que usa la aplicación con su cuenta de Google. | equipos | `ItTechnician` |
| Inventario de IT | Sistema de IT que se conecta a la API con una cuenta de servicio de Google. | equipos | `ItInventory` |
| Token de identidad | Token de identidad de Google, con el correo verificado y emitido para el cliente OAuth de la aplicación, que acompaña cada llamada a la API. | equipos | `IdToken` |
| Cliente OAuth de la aplicación | Cliente OAuth de Google de la aplicación, cuyo identificador recibe la aplicación como `GOOGLE_CLIENT_ID`. | equipos | `googleClientId` |
