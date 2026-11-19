# 0004. La lista de equipos con su préstamo la sirve el contexto «prestamos»

- **Estado:** Propuesto
- **Fecha:** 19/11/2026
- **Contexto delimitado:** equipos, prestamos

## Contexto

La operación `GET /api/equipos` de la API fijada por el cliente devuelve cada equipo con `prestado` y, si está prestado, con `persona` y `devolucion`. Necesita datos de dos contextos: los equipos, de «equipos», y los préstamos activos, de «prestamos». «prestamos» ya depende de «equipos» para comprobar que un equipo existe, y las dependencias entre contextos no pueden formar un ciclo.

## Opciones

1. **La sirve «prestamos».** Lee los equipos por el `index.ts` de «equipos» y les añade su préstamo activo. La dependencia va en un solo sentido: «prestamos» depende de «equipos».
2. **La sirve «equipos».** Tendría que leer los préstamos de «prestamos», que a su vez depende de «equipos»: un ciclo.
3. **Un solo contexto para todo.** Evita la pregunta, pero mezcla los datos del inventario con lo que les pasa a lo largo del tiempo.

## Decisión

La opción 1. Una operación que solo lee va con el contexto cuyos datos necesita sin crear un ciclo.

## Consecuencias

- La ruta `/api/equipos` está en dos contratos: `POST` en «equipos» y `GET` en «prestamos».
- «equipos» ofrece en su `index.ts` la lectura de todos los equipos y la de un equipo por su id, que «prestamos» usa en proceso.
- El alta de un equipo responde siempre con `prestado: false`, porque un equipo recién creado no tiene préstamo; «equipos» no consulta a «prestamos».
