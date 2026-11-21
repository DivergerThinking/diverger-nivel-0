# Contexto «Equipos»

## Propósito

Mantiene la lista de los equipos de la oficina que se pueden prestar. Un técnico de IT, o el inventario de IT, da de alta cada equipo con su nombre, y el contexto garantiza que no hay dos con el mismo nombre.

## Modelo

- **Equipo** (agregado): `id`, que genera el contexto, y `nombre`, tal como se escribió en el alta.
- **Nombre normalizado** (objeto de valor): el nombre sin espacios al principio ni al final y en minúsculas. Sirve solo para comparar nombres.

El contexto no sabe si un equipo está prestado: eso es de «préstamos». El alta responde con `prestado: false` porque un equipo recién creado no tiene préstamo activo.

## Invariantes

- Un equipo tiene un nombre que no está vacío: sin nombre, o con un nombre vacío, el alta responde 400 «Falta el nombre del equipo».
- No hay dos equipos con el mismo nombre normalizado: el alta de un nombre repetido responde 409 «Ya hay un equipo con ese nombre» (concurrencia, [ADR 0002](../../../docs/adr/0002-nombre-de-equipo-unico.md)).
- Un equipo dado de alta no cambia ni se da de baja.

## Persistencia

A través del puerto de persistencia (`lib/datos.ts`), en dos colecciones que solo escribe este contexto:

- `equipos_equipos`: un documento por equipo, con su `id` y su `nombre`.
- `equipos_nombres`: un documento por nombre normalizado, con el `id` de su equipo.

El alta lee el documento del nombre y guarda los dos documentos en una sola transacción del almacén.

## Dependencias

Ninguna.

El `index.ts` del contexto ofrece a los demás la lista de equipos y la consulta de un equipo por su id.

## Decisiones

- [ADR 0001](../../../docs/adr/0001-api-fijada-por-el-cliente.md): el contrato sigue la API fijada por el cliente.
- [ADR 0002](../../../docs/adr/0002-nombre-de-equipo-unico.md): cómo se garantiza que no hay dos equipos con el mismo nombre.
- [ADR 0004](../../../docs/adr/0004-la-lista-de-equipos-esta-en-prestamos.md): la lista de equipos la sirve «préstamos».
