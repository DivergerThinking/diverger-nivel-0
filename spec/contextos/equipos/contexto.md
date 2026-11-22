# Contexto «Equipos»

## Propósito

Es dueño del inventario de equipos de la oficina: da de alta cada equipo con un nombre y garantiza que no haya dos equipos con el mismo nombre. No sabe si un equipo está prestado: eso lo gobierna el contexto de préstamos.

## Modelo

- **Equipo** (`Equipment`): identificador opaco generado por el servidor y nombre del equipo.
- **Nombre del equipo** (`EquipmentName`): texto no vacío, guardado sin espacios al principio ni al final y con las mayúsculas con que se escribió.
- **Clave del nombre** (`NameKey`): el nombre del equipo en minúsculas. Sirve para decidir si dos nombres son el mismo.

Su `index.ts` ofrece a otros contextos dos lecturas: obtener un equipo por su identificador y listar los equipos.

## Invariantes

- Un equipo tiene siempre un nombre del equipo que no está vacío.
- Dos nombres son el mismo si tienen la misma clave del nombre; no puede haber dos equipos con la misma clave (concurrencia) [ADR 0001](../../../docs/adr/0001-nombre-de-equipo-unico.md).
- Un equipo recién dado de alta no está prestado.
- Toda operación exige un token de identidad de Google válido; sin él responde 401 con «Inicia sesión con Google.».

## Persistencia

Colecciones escritas solo por este contexto, con su id delante como pide el puerto de persistencia:

- `equipos_equipos`: un documento por equipo, con el identificador como id, con su nombre.
- `equipos_nombres`: un documento por clave del nombre, que apunta al identificador del equipo.

El alta es una transacción que lee el documento de la clave y, si no existe, escribe el equipo y el documento de la clave. No hay transacciones que crucen contextos.

## Dependencias

Ninguna.

## Decisiones

- [ADR 0001](../../../docs/adr/0001-nombre-de-equipo-unico.md): cómo se garantiza que un nombre no se repita.
- [ADR 0003](../../../docs/adr/0003-api-fijada-por-el-cliente.md): el contrato copia la API fijada por el cliente.
