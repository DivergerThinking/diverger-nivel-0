# Contexto «Equipos»

## Propósito

Guarda los equipos de la oficina que IT puede prestar. Da de alta cada equipo con su nombre y garantiza que no hay dos equipos con el mismo nombre.

## Modelo

- **Equipo** (agregado): `id` (texto generado), `nombre` (el que escribe IT) y su nombre normalizado.
- **Nombre normalizado** (objeto de valor): el nombre sin espacios al principio ni al final y en minúsculas.

## Invariantes

- Un equipo siempre tiene nombre: un nombre que falta, está vacío o solo tiene espacios se rechaza con 400 «Falta el nombre del equipo».
- Dos equipos no tienen el mismo nombre normalizado: el segundo se rechaza con 409 «Ya hay un equipo con ese nombre» (concurrencia, [ADR 0001](../../../docs/adr/0001-nombre-de-equipo-unico.md)).
- El nombre se guarda y se devuelve tal como lo escribe IT, sin normalizar.
- Un equipo recién dado de alta no está prestado.

## Persistencia

- `equipos_equipos`: un documento por equipo, con id el `id` del equipo, y los campos `id`, `nombre` y `nombreNormalizado`.
- `equipos_nombres`: un documento por nombre normalizado, con id el nombre normalizado y el campo `equipoId`.
- El alta lee `equipos_nombres` y escribe los dos documentos en una sola transacción del puerto de persistencia.

## Dependencias

Ninguna.

## Decisiones

- [ADR 0001](../../../docs/adr/0001-nombre-de-equipo-unico.md): documento por nombre normalizado para que no haya dos equipos con el mismo nombre.
- [ADR 0003](../../../docs/adr/0003-api-fijada-por-el-cliente.md): el contrato sigue la API fijada por el cliente.
- [ADR 0004](../../../docs/adr/0004-lista-de-equipos-en-prestamos.md): la lista de equipos la sirve prestamos; este contexto expone en su `index.ts` la lectura de un equipo y la lista de equipos.
