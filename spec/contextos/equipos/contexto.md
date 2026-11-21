# Contexto «Equipos»

## Propósito

Guarda los equipos de la oficina que IT puede prestar. Da de alta cada equipo con un nombre que no se repite y dice a los demás contextos qué equipos existen.

## Modelo

- **Equipo** (agregado): `id`, que genera la aplicación, y `nombre`, el nombre de equipo tal como se escribió.
- **Nombre normalizado** (objeto de valor): el nombre de equipo sin espacios al principio ni al final y en minúsculas. Sirve solo para comparar.

El contexto expone en `src/equipos/index.ts` dos lecturas en proceso para otros contextos: listar los equipos y obtener un equipo por su id.

## Invariantes

- Un equipo tiene siempre un nombre de equipo que no está vacío. Sin él, el alta responde 400 «Falta el nombre del equipo».
- Dos equipos no tienen el mismo nombre normalizado; el segundo alta responde 409 «Ya hay un equipo con ese nombre» (concurrencia, [ADR 0001](../../../docs/adr/0001-nombre-de-equipo-unico.md)).
- Un equipo recién dado de alta no está prestado: el alta responde `prestado: false`.
- Sin un token válido, la operación responde 401 «Inicia sesión con Google.» y no guarda nada.

## Persistencia

Solo a través del puerto de persistencia (`lib/datos.ts`), en dos colecciones que solo escribe este contexto:

- `equipos_equipos`: un documento por equipo, con su `id` como id del documento y su `nombre`.
- `equipos_nombres`: un documento por nombre normalizado, cuyo id es su SHA-256 en hexadecimal, con el `id` del equipo.

El alta lee el documento del nombre y guarda los dos documentos en una misma transacción.

## Dependencias

Ninguna.

## Decisiones

- [ADR 0001](../../../docs/adr/0001-nombre-de-equipo-unico.md): el nombre de un equipo no se repite.
- [ADR 0003](../../../docs/adr/0003-api-fijada-por-el-cliente.md): los contratos siguen la API fijada por el cliente.
- [ADR 0004](../../../docs/adr/0004-la-lista-de-equipos-la-sirve-prestamos.md): la lista de equipos con su préstamo la sirve el contexto «prestamos».
