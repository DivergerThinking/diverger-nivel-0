# 0002. Un nombre de equipo no se repite

- **Estado:** Propuesto
- **Fecha:** 19/11/2026
- **Contexto delimitado:** equipos

## Contexto

No puede haber dos equipos con el mismo nombre, y dos nombres son el mismo si solo se diferencian en mayúsculas o en espacios al principio o al final. Comprobarlo antes de escribir no basta: dos altas a la vez con el mismo nombre pasarían las dos la comprobación.

## Opciones

1. **Un documento por nombre normalizado, dentro de una transacción.** La colección `equipos_nombres` tiene un documento cuyo id sale del nombre normalizado. El alta lee ese documento en una transacción del puerto de persistencia: si existe, responde 409; si no, guarda en la misma transacción el documento del nombre y el del equipo.
2. **Listar y comparar antes de guardar.** El alta lista los equipos, compara los nombres normalizados y guarda si no hay ninguno igual. Es más simple, pero no es atómico: dos altas a la vez crean dos equipos con el mismo nombre.

## Decisión

La opción 1. El puerto de persistencia solo lee por id dentro de una transacción, así que la regla se apoya en un documento cuyo id es el nombre normalizado; la transacción se repite si otra alta lo crea entretanto.

## Consecuencias

- El contexto «equipos» escribe en dos colecciones propias: `equipos_equipos` y `equipos_nombres`.
- El id del documento del nombre se obtiene del nombre normalizado con una codificación que admite cualquier carácter (por ejemplo, `encodeURIComponent`), para que valga como id.
- Los tests cubren dos altas a la vez con nombres que solo cambian en mayúsculas o espacios.
