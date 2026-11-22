# Contexto «Préstamos»

## Propósito

Apunta a quién se presta cada equipo y hasta cuándo, y su devolución. Sirve la lista de equipos con su estado de préstamo, que IT y el inventario de IT consultan.

## Modelo

- **Préstamo activo** (agregado): el `equipoId`, la `persona` (texto libre) y la `devolucion` (fecha `AAAA-MM-DD`).
- **Fecha de devolución** (objeto de valor): texto `AAAA-MM-DD` de una fecha que existe; se devuelve igual que llega.
- **Equipo con su préstamo** (vista): el `id` y el `nombre` del equipo, `prestado` y, si está prestado, `persona` y `devolucion`.

## Invariantes

- Un equipo tiene como mucho un préstamo activo: prestar uno ya prestado responde 409 «El equipo ya está prestado» y el préstamo anterior no cambia (concurrencia, [ADR 0002](../../../docs/adr/0002-un-prestamo-activo-por-equipo.md)).
- Solo se devuelve un equipo prestado: si no lo está, 409 «El equipo no está prestado» (concurrencia, [ADR 0002](../../../docs/adr/0002-un-prestamo-activo-por-equipo.md)).
- Un préstamo tiene persona y fecha de devolución: si falta alguna, 400 «Faltan la persona o la fecha de devolución».
- La fecha de devolución tiene el formato `AAAA-MM-DD` y existe («2026-02-30» no vale); si no, 400 «La fecha de devolución no es válida». Una fecha pasada se acepta.
- Solo se presta o se devuelve un equipo que existe: si no, 404 «No existe el equipo».
- Un equipo sin préstamo activo aparece en la lista con `prestado: false` y sin `persona` ni `devolucion`.

## Persistencia

- `prestamos_activos`: un documento por equipo prestado, con id el id del equipo y los campos `equipoId`, `persona` y `devolucion`.
- Prestar lee el documento y lo crea en una transacción; devolver lo lee y lo borra en una transacción.
- No guarda historial: la devolución borra el préstamo activo.

## Dependencias

- **equipos**: lee un equipo por id para saber si existe y su nombre, y la lista de equipos para la lista con su préstamo, a través del `index.ts` de equipos.

## Decisiones

- [ADR 0002](../../../docs/adr/0002-un-prestamo-activo-por-equipo.md): un documento de préstamo activo por equipo.
- [ADR 0003](../../../docs/adr/0003-api-fijada-por-el-cliente.md): el contrato sigue la API fijada por el cliente, con rutas bajo `/api/equipos`.
- [ADR 0004](../../../docs/adr/0004-lista-de-equipos-en-prestamos.md): este contexto sirve `GET /api/equipos`.
