# Préstamos de equipos de IT

## Fuentes

- .diverger/inbox/peticion.md: petición del cliente con su anexo «API para el inventario de IT». Aporta el problema, los usuarios, el objetivo, el alcance, lo que queda fuera, las restricciones, los riesgos y la API fijada.
- .diverger/inbox/equipo.csv: lista del equipo que construye el producto. Aporta que lo forma una persona con rol de Desarrollo, con dedicación «100» y que usa agente de IA. No aporta requisitos de producto.

## Objetivo

Hoy los préstamos se apuntan en una hoja de cálculo que nadie mantiene al día: no se sabe qué equipos están prestados ni a quién, y cada pocos meses se pierde alguno o alguien se queda sin portátil porque se creía que estaba libre (peticion.md).

Tener una lista de los equipos de la oficina donde IT pueda apuntar a quién ha prestado cada uno y cuándo lo devuelve (peticion.md).

Métricas de éxito: el proyecto se da por bueno si durante el primer mes todos los préstamos se apuntan en la aplicación y no se pierde ningún equipo (peticion.md).

## Usuarios

- Equipo de IT: es el único que usa la aplicación y entra con su cuenta de Google de la empresa. Da de alta los equipos, apunta préstamos y devoluciones y consulta qué está prestado (peticion.md).
- Inventario de IT: sistema que se conecta a la aplicación por la API y entra con una cuenta de servicio (peticion.md, anexo).

## Alcance

- Dar de alta equipos con un nombre, por ejemplo «Portátil 07» o «Proyector sala 2» (peticion.md).
- Apuntar cada préstamo con la persona y la fecha en que tiene que devolverse (peticion.md).
- Apuntar la devolución cuando devuelven el equipo (peticion.md).
- Ver en todo momento qué equipos están prestados, a quién y hasta cuándo (peticion.md).
- No admitir dos equipos con el mismo nombre: dos nombres son el mismo si solo se diferencian en mayúsculas o en espacios al principio o al final (peticion.md, anexo).
- Validar la fecha de devolución: texto AAAA-MM-DD que sea una fecha que exista; una fecha pasada se acepta, porque IT a veces apunta los préstamos con retraso (peticion.md, anexo).
- Exponer la API del anexo para el inventario de IT: dar de alta un equipo, ver los equipos, prestar un equipo y apuntar la devolución, con los códigos y mensajes de error indicados (peticion.md, anexo).

## Fuera de alcance

- Que los empleados pidan algo desde la aplicación (peticion.md).
- Avisos de préstamos vencidos (peticion.md).
- Limitar el acceso a las cuentas de IT, por ahora (peticion.md, anexo).

## Restricciones

- Todas las rutas necesitan haber iniciado sesión: vale el token de identidad de Google, con el correo verificado, emitido para el cliente OAuth de la aplicación, de una persona o de una cuenta de servicio; sin un token válido responden 401 con «Inicia sesión con Google.» (peticion.md, anexo).
- Los errores son un objeto JSON `{"error": "<mensaje>"}` con el mensaje exacto que se indica (peticion.md, anexo).
- La API tiene que ser exactamente la del anexo, porque el inventario de IT se va a conectar a la aplicación (peticion.md, anexo).
- Integración: el inventario de IT se conecta a la aplicación por la API (peticion.md, anexo).
- Dependencia: acceso con la cuenta de Google de la empresa (peticion.md).

## API fijada por el cliente

Todas las rutas necesitan haber iniciado sesión: sin un token válido responden 401 con «Inicia sesión con Google.». Vale el token de identidad de Google, con el correo verificado, emitido para el cliente OAuth de la aplicación, tanto de una persona como de una cuenta de servicio: el inventario entra con una cuenta de servicio. Por ahora no hace falta limitar el acceso a las cuentas de IT. Los errores son un objeto JSON `{"error": "<mensaje>"}` con el mensaje exacto que se indica.

| Operación | Petición | Respuesta correcta | Errores |
|---|---|---|---|
| Dar de alta un equipo | `POST /api/equipos` con `{"nombre": "Portátil 07"}` | 201 con `{"id": "…", "nombre": "Portátil 07", "prestado": false}` | 400 «Falta el nombre del equipo» si el nombre falta o está vacío. 409 «Ya hay un equipo con ese nombre» |
| Ver los equipos | `GET /api/equipos` | 200 con la lista de equipos, cada uno con `id`, `nombre` y `prestado`; si está prestado, también `persona` y `devolucion` | — |
| Prestar un equipo | `POST /api/equipos/{id}/prestamo` con `{"persona": "Ana Pérez", "devolucion": "2026-11-20"}` | 201 con el equipo: `id`, `nombre`, `prestado: true`, `persona` y `devolucion` | 400 «Faltan la persona o la fecha de devolución». 400 «La fecha de devolución no es válida» si no es una fecha real. 404 «No existe el equipo». 409 «El equipo ya está prestado» |
| Apuntar la devolución | `POST /api/equipos/{id}/devolucion` | 200 con el equipo y `prestado: false` | 404 «No existe el equipo». 409 «El equipo no está prestado» |

La fecha de devolución va como texto `AAAA-MM-DD` y se devuelve igual. Tiene que ser una fecha que exista («2026-02-30» no vale); una fecha pasada se acepta, porque IT a veces apunta los préstamos con retraso.

Dos nombres de equipo son el mismo si solo se diferencian en mayúsculas o en espacios al principio o al final: « portátil 07 » repite «Portátil 07».

(peticion.md, «Anexo: API para el inventario de IT»)

## Riesgos

- Que IT deje de usar la aplicación si apuntar un préstamo cuesta más de un minuto (peticion.md).
- Que el inventario deje de funcionar si la API cambia (peticion.md).

## Supuestos

- [SUPUESTO] La aplicación es web y tiene una interfaz para IT además de la API — la petición dice que IT «entra con su cuenta de Google» y «ve en todo momento» los préstamos, pero no dice que haya pantalla.
- [SUPUESTO] El token de Google se envía como Bearer en la cabecera Authorization — el anexo no indica la cabecera.
- [SUPUESTO] El estado «prestado» se calcula a partir del préstamo abierto y la devolución lo cierra — se deduce del comportamiento de la API.
- [SUPUESTO] «Todos los préstamos» del criterio de éxito son los que gestiona IT con la aplicación — la petición no lo define de otro modo.
- [SUPUESTO] La dedicación «100» del equipo es un porcentaje de la jornada — equipo.csv no indica la unidad.
- [SUPUESTO] equipo.csv describe al equipo que construye el producto, no a sus usuarios — sus columnas hablan de rol, dedicación y uso de agente de IA.

## Preguntas abiertas

1. [alta] ¿Hace falta una interfaz web para IT o basta con la API?
2. [alta] ¿Debe restringirse el acceso a las cuentas de IT (por dominio o por lista) cuando termine el «por ahora»? Mientras tanto, cualquier cuenta de Google con un token válido tendría acceso.
3. [media] ¿Cómo se mide «no se pierde ningún equipo» y quién lo comprueba al cabo del primer mes?
4. [media] ¿«Más de un minuto» incluye iniciar sesión y localizar el equipo, o solo rellenar el préstamo?
5. [media] ¿Hay que editar, renombrar o dar de baja equipos, y conservar el historial de préstamos? La API no lo contempla.
6. [media] ¿Cuántos equipos y préstamos se esperan, y hay que importar los datos de la hoja de cálculo actual?
7. [media] ¿Hay fecha límite, presupuesto o restricciones de plataforma o tecnología?
8. [baja] ¿Hay límite de longitud en el nombre del equipo y en la persona?
9. [baja] ¿Puede cambiar la API en el futuro (con versiones) sin romper el inventario?
10. [baja] ¿Hay otras personas (producto, diseño, pruebas) que deban figurar en el equipo?

## Claridad

| Categoría | Claridad |
|---|---|
| Usuarios | 75 % |
| Problema | 75 % |
| Objetivo y métricas | 50 % |
| Alcance | 100 % |
| Fuera de alcance | 75 % |
| Restricciones | 50 % |
| Dependencias e integraciones | 50 % |
| Riesgos | 50 % |
| Global | 66 % |
