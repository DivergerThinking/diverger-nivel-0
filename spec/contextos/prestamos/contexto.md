# Contexto «Préstamos»

## Propósito

Es dueño de lo que les pasa a los equipos con el tiempo: a quién se prestan y hasta cuándo, y cuándo vuelven. Responde también a la lista de equipos con su estado de préstamo, porque necesita los datos de los dos contextos.

## Modelo

- **Préstamo activo** (`ActiveLoan`): el préstamo de un equipo que aún no se ha devuelto. Guarda el identificador del equipo, el prestatario y la fecha de devolución.
- **Prestatario** (`Borrower`): la persona a quien se presta el equipo, en el campo `persona` de la API. Texto que no puede estar vacío.
- **Fecha de devolución** (`DueDate`): texto AAAA-MM-DD, que se devuelve igual que se recibe.
- **Equipo prestado** (`LentEquipment`): un equipo con préstamo activo. Un equipo sin préstamo activo está libre.
- **Devolución** (`Return`): borra el préstamo activo del equipo.

Los datos del equipo (identificador y nombre) los lee del contexto de equipos.

## Invariantes

- Un equipo tiene como mucho un préstamo activo, de modo que nunca se presta a dos personas a la vez (concurrencia) [ADR 0002](../../../docs/adr/0002-un-prestamo-activo-por-equipo.md).
- Un equipo está prestado si y solo si tiene un préstamo activo.
- Un préstamo se apunta con un prestatario y una fecha de devolución, y se rechaza si falta alguno de los dos.
- La fecha de devolución es una fecha que existe, en formato AAAA-MM-DD; una fecha pasada se acepta, porque IT a veces apunta los préstamos con retraso.
- Solo se presta o se devuelve un equipo que existe.
- Solo se devuelve un equipo que tiene un préstamo activo; un equipo devuelto vuelve a estar libre y se puede prestar a otra persona.
- Toda operación exige un token de identidad de Google válido; sin él responde 401 con «Inicia sesión con Google.».

## Persistencia

Colección escrita solo por este contexto, con su id delante como pide el puerto de persistencia:

- `prestamos_activos`: un documento por préstamo activo, con el identificador del equipo como id, con el prestatario y la fecha de devolución.

Prestar y devolver son transacciones sobre ese documento. Solo se guarda el préstamo activo: al devolver, el documento se borra y no queda historial. No hay transacciones que crucen contextos: la existencia del equipo se comprueba antes de la transacción, con la lectura del contexto de equipos.

## Dependencias

Consume el contexto `equipos` a través de su `index.ts`, para comprobar que un equipo existe y para leer el identificador y el nombre de cada equipo al listarlos.

## Decisiones

- [ADR 0002](../../../docs/adr/0002-un-prestamo-activo-por-equipo.md): cómo se garantiza que un equipo no se preste dos veces.
- [ADR 0003](../../../docs/adr/0003-api-fijada-por-el-cliente.md): el contrato copia la API fijada por el cliente.
