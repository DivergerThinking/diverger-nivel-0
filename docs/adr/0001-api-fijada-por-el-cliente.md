# 0001. Los contratos siguen la API fijada por el cliente

- **Estado:** Propuesto
- **Fecha:** 19/11/2026
- **Contexto delimitado:** equipos, prestamos

## Contexto

El inventario de IT se va a conectar a la aplicación, y la petición del cliente fija la API en un anexo: cuatro operaciones con sus rutas, campos, códigos y mensajes de error exactos. Esa API no sigue dos convenciones del formato de `spec/`: las rutas no llevan el prefijo `/api/<id>/` del contexto y los errores no son RFC 9457.

## Opciones

1. **Copiar la API del cliente tal cual.** Las rutas son `/api/equipos`, `/api/equipos/{id}/prestamo` y `/api/equipos/{id}/devolucion`, y los errores son `{"error": "<mensaje>"}` en `application/json`, con los mensajes del anexo carácter a carácter.
2. **Seguir las convenciones del formato.** Rutas bajo `/api/equipos/` y `/api/prestamos/`, y errores `application/problem+json`. El inventario tendría que adaptarse a una API distinta de la que el cliente fijó.

## Decisión

La opción 1. El cliente dice que la API tiene que ser exactamente la del anexo, y el riesgo que más le preocupa es que el inventario deje de funcionar si la API cambia.

## Consecuencias

- Los dos contratos comparten la ruta `/api/equipos` con métodos distintos: `POST` en «equipos» y `GET` en «prestamos». Cada contexto registra sus rutas sin prefijo.
- El esquema de error de los dos contratos es un objeto con la propiedad obligatoria `error`.
- Los campos de la API van en español, como en el anexo (`nombre`, `prestado`, `persona`, `devolucion`); los identificadores del código siguen el glosario.
- Cambiar una ruta, un código o un mensaje es un cambio incompatible de contrato: una tarea propia, en serie y con su ADR.
