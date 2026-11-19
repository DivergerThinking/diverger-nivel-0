# Contexto «Préstamos»

## Propósito

Apunta a quién se ha prestado cada equipo y cuándo tiene que devolverlo, y apunta la devolución. Sirve la lista de los equipos con su estado: cuáles están prestados, a quién y hasta cuándo.

## Modelo

- **Préstamo activo** (agregado): el id del equipo, la **persona** y la **fecha de devolución**. Un equipo tiene como mucho uno.
- **Fecha de devolución** (objeto de valor): texto `AAAA-MM-DD` que es una fecha que existe. Se guarda y se devuelve igual. Puede ser una fecha pasada.
- **Equipo con préstamo** (vista de lectura): un equipo del contexto «equipos» con `prestado` y, si está **prestado**, con `persona` y `devolucion`.
- **Devolución**: la acción que termina el préstamo activo de un equipo.

## Invariantes

- Un préstamo tiene siempre persona y fecha de devolución. Si falta alguna, prestar responde 400 con «Faltan la persona o la fecha de devolución».
- La fecha de devolución es una fecha que existe: «2026-02-30» no vale y prestar responde 400 con «La fecha de devolución no es válida». Una fecha pasada se acepta.
- Solo se presta y se devuelve un equipo que existe. Si no existe, responde 404 con «No existe el equipo».
- Un equipo tiene como mucho un préstamo activo: prestar un equipo prestado responde 409 con «El equipo ya está prestado» (concurrencia, [ADR 0003](../../../docs/adr/0003-un-prestamo-activo-por-equipo.md)).
- Solo se devuelve un equipo prestado: devolver un equipo que no lo está responde 409 con «El equipo no está prestado» (concurrencia, [ADR 0003](../../../docs/adr/0003-un-prestamo-activo-por-equipo.md)).
- Un equipo sin préstamo activo aparece en la lista con `prestado: false`, sin `persona` ni `devolucion`.

## Persistencia

Colección de Firestore, a través del puerto de persistencia, escrita solo por este contexto:

- `prestamos_activos`: como mucho un documento por equipo, con el id del equipo como id, la persona y la fecha de devolución.

Prestar lee y guarda ese documento en una transacción; devolver lo lee y lo borra en una transacción. Ninguna transacción toca las colecciones de «equipos».

## Dependencias

- **equipos:** para comprobar que un equipo existe antes de prestarlo o devolverlo y para leer todos los equipos de la lista. Lo usa en proceso, por su `index.ts`.

## Decisiones

- [ADR 0001](../../../docs/adr/0001-api-fijada-por-el-cliente.md): el contrato sigue la API fijada por el cliente.
- [ADR 0003](../../../docs/adr/0003-un-prestamo-activo-por-equipo.md): un equipo tiene como mucho un préstamo activo.
- [ADR 0004](../../../docs/adr/0004-lista-de-equipos-en-prestamos.md): la lista de equipos con su préstamo la sirve este contexto.
