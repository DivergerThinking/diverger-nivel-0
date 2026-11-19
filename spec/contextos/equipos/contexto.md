# Contexto «Equipos»

## Propósito

Mantiene la lista de los equipos de la oficina que IT puede prestar. Da de alta cada equipo con su nombre y garantiza que no haya dos con el mismo nombre. No sabe nada de préstamos.

## Modelo

- **Equipo** (agregado): `id`, que genera el servidor, y **nombre**.
- **Nombre normalizado** (objeto de valor): el nombre sin espacios al principio ni al final y en minúsculas. Sirve solo para comparar; el equipo conserva su nombre.

El módulo ofrece a otros contextos, en su `index.ts`, la lectura de todos los equipos y la de un equipo por su id.

## Invariantes

- Un equipo tiene siempre un nombre que no está vacío. Sin nombre, el alta responde 400 con «Falta el nombre del equipo».
- No hay dos equipos con el mismo nombre normalizado. El alta de un nombre que ya existe responde 409 con «Ya hay un equipo con ese nombre» (concurrencia, [ADR 0002](../../../docs/adr/0002-nombre-de-equipo-unico.md)).
- Un equipo recién dado de alta no está prestado: el alta responde con `prestado: false`.

## Persistencia

Colecciones de Firestore, a través del puerto de persistencia, escritas solo por este contexto:

- `equipos_equipos`: un documento por equipo, con su `id` y su nombre.
- `equipos_nombres`: un documento por nombre normalizado, con el id del equipo que lo tiene.

El alta lee el documento del nombre y guarda los dos documentos en una sola transacción.

## Dependencias

Ninguna.

## Decisiones

- [ADR 0001](../../../docs/adr/0001-api-fijada-por-el-cliente.md): el contrato sigue la API fijada por el cliente.
- [ADR 0002](../../../docs/adr/0002-nombre-de-equipo-unico.md): un nombre de equipo no se repite.
- [ADR 0004](../../../docs/adr/0004-lista-de-equipos-en-prestamos.md): la lista de equipos con su préstamo la sirve «prestamos».
