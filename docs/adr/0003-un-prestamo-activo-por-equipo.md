# 0003. Un equipo tiene como mucho un préstamo activo

- **Estado:** Propuesto
- **Fecha:** 19/11/2026
- **Contexto delimitado:** prestamos

## Contexto

Un equipo prestado no se puede prestar otra vez hasta que se apunte su devolución, y solo se puede devolver un equipo prestado. Comprobar el estado antes de escribir no basta: dos préstamos del mismo equipo a la vez pasarían los dos la comprobación.

## Opciones

1. **Un documento por equipo con su préstamo activo, dentro de una transacción.** La colección `prestamos_activos` tiene como mucho un documento por equipo, con el id del equipo. Prestar lee ese documento en una transacción del puerto de persistencia: si existe, responde 409; si no, lo guarda. Devolver lo lee en una transacción: si no existe, responde 409; si existe, lo borra.
2. **Una colección de préstamos con estado.** Cada préstamo es un documento con id propio y un campo que dice si está activo. Para saber si un equipo está prestado hay que listar la colección, y el puerto no lista dentro de una transacción, así que la comprobación no es atómica.

## Decisión

La opción 1. El id del documento es el del equipo, de modo que la transacción lee y escribe un solo documento conocido y se repite si otra petición lo cambia entretanto.

## Consecuencias

- El equipo está prestado si existe su documento en `prestamos_activos`; no hay un campo de estado aparte.
- La devolución borra el préstamo: no se conserva el historial de préstamos, que queda fuera de esta entrega.
- Los tests cubren dos préstamos a la vez del mismo equipo: uno responde 201 y el otro 409.
