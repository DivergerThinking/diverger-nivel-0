# Contexto «Préstamos»

## Propósito

Apunta a quién se presta cada equipo y hasta cuándo, y su devolución. Enseña la lista de equipos con su préstamo, para que IT sepa en todo momento qué está prestado, a quién y hasta cuándo.

## Modelo

- **Préstamo activo** (agregado): el id del equipo, la `persona` y la `devolucion`, la fecha de devolución como texto AAAA-MM-DD. Existe mientras el equipo está prestado y se borra con la devolución.
- **Equipo con su préstamo** (vista de lectura): el `id` y el `nombre` del equipo, `prestado` y, solo si está prestado, `persona` y `devolucion`.

## Invariantes

- Un equipo tiene como mucho un préstamo activo: prestar un equipo prestado responde 409 «El equipo ya está prestado» y no cambia su préstamo (concurrencia, [ADR 0002](../../../docs/adr/0002-un-prestamo-activo-por-equipo.md)).
- Solo se devuelve un equipo prestado: devolver uno sin prestar responde 409 «El equipo no está prestado» (concurrencia, [ADR 0002](../../../docs/adr/0002-un-prestamo-activo-por-equipo.md)).
- Un préstamo activo tiene siempre persona y fecha de devolución; sin una de las dos, prestar responde 400 «Faltan la persona o la fecha de devolución».
- La fecha de devolución es una fecha que existe, en formato AAAA-MM-DD, y se devuelve igual; «2026-02-30» responde 400 «La fecha de devolución no es válida». Una fecha pasada se acepta.
- Solo se presta o se devuelve un equipo que existe; si no, la operación responde 404 «No existe el equipo».
- Sin un token válido, toda operación responde 401 «Inicia sesión con Google.» y no cambia nada.

## Persistencia

Solo a través del puerto de persistencia (`lib/datos.ts`), en una colección que solo escribe este contexto:

- `prestamos_activos`: como mucho un documento por equipo, cuyo id es el id del equipo, con `persona` y `devolucion`.

Prestar lee ese documento y lo guarda en una misma transacción; devolver lo lee y lo borra en una misma transacción. La lista lee los equipos con el `index.ts` de «equipos» y esta colección, sin transacción.

## Dependencias

- «equipos»: le pide la lista de equipos y un equipo por su id, en proceso y a través de su `index.ts`, para enseñar la lista y para comprobar que el equipo existe.

## Decisiones

- [ADR 0002](../../../docs/adr/0002-un-prestamo-activo-por-equipo.md): un equipo tiene como mucho un préstamo activo.
- [ADR 0003](../../../docs/adr/0003-api-fijada-por-el-cliente.md): los contratos siguen la API fijada por el cliente.
- [ADR 0004](../../../docs/adr/0004-la-lista-de-equipos-la-sirve-prestamos.md): la lista de equipos con su préstamo la sirve este contexto.
