# Contexto «Préstamos»

## Propósito

Apunta a quién se ha prestado cada equipo y hasta cuándo, y apunta su devolución. Sirve la lista de equipos con su préstamo, que usan las pantallas de IT y el inventario de IT para saber qué está prestado.

## Modelo

- **Préstamo activo** (agregado): el equipo, por su `id`; la **persona**, como texto libre; y la **fecha de devolución**, como texto `AAAA-MM-DD`.
- **Equipo con su préstamo** (vista de lectura): el `id` y el `nombre` del equipo, `prestado` y, solo si está prestado, `persona` y `devolucion`.
- **Devolución**: termina el préstamo activo del equipo.

## Invariantes

- Un préstamo tiene persona y fecha de devolución: si falta una de las dos, o está vacía, prestar responde 400 «Faltan la persona o la fecha de devolución».
- La fecha de devolución es un texto `AAAA-MM-DD` de una fecha que existe («2026-02-30» no vale); si no, prestar responde 400 «La fecha de devolución no es válida». Una fecha pasada se acepta. La fecha se devuelve igual que se recibió.
- Solo se presta y se devuelve un equipo que existe: si no, 404 «No existe el equipo».
- Un equipo tiene como mucho un préstamo activo: prestar un equipo prestado responde 409 «El equipo ya está prestado» (concurrencia, [ADR 0003](../../../docs/adr/0003-un-prestamo-activo-por-equipo.md)).
- Solo se devuelve un equipo prestado: devolver un equipo sin prestar responde 409 «El equipo no está prestado» (concurrencia, [ADR 0003](../../../docs/adr/0003-un-prestamo-activo-por-equipo.md)).
- Un equipo sin prestar aparece en la lista sin `persona` ni `devolucion`.

## Persistencia

A través del puerto de persistencia (`lib/datos.ts`), en una colección que solo escribe este contexto:

- `prestamos_activos`: como mucho un documento por equipo, con el id del equipo como id, la persona y la fecha de devolución.

Prestar lee y guarda ese documento en una transacción del almacén; devolver lo lee y lo borra en otra. Ninguna transacción toca las colecciones de «equipos».

## Dependencias

- **equipos**: para saber si un equipo existe antes de prestarlo o devolverlo, y para la lista de equipos, por su `index.ts`.

## Decisiones

- [ADR 0001](../../../docs/adr/0001-api-fijada-por-el-cliente.md): el contrato sigue la API fijada por el cliente.
- [ADR 0003](../../../docs/adr/0003-un-prestamo-activo-por-equipo.md): cómo se garantiza que un equipo tiene como mucho un préstamo activo.
- [ADR 0004](../../../docs/adr/0004-la-lista-de-equipos-esta-en-prestamos.md): la lista de equipos la sirve este contexto.
