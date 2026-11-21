# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-INV-01
Característica: Dar de alta un equipo
  Como persona de IT, quiero dar de alta un equipo de la oficina con un nombre que no se repite, para tener cada equipo una sola vez en la lista y saber de cuál se habla al prestarlo.

  @HU-INV-01-1 @positivo
  Escenario: HU-INV-01 criterio 1 (positivo)
    Dado una persona de IT con sesión iniciada y ningún equipo llamado «Portátil 07» en la lista
    Cuando da de alta un equipo con el nombre «Portátil 07»
    Entonces el equipo «Portátil 07» aparece en la lista como no prestado y la API responde 201 con su `id`, el `nombre` «Portátil 07» y `prestado: false`

  @HU-INV-01-2 @negativo
  Escenario: HU-INV-01 criterio 2 (negativo)
    Dado una persona de IT con sesión iniciada
    Cuando da de alta un equipo con el nombre vacío
    Entonces ve «Falta el nombre del equipo», la API responde 400 y no se guarda ningún equipo

  @HU-INV-01-3 @negativo
  Escenario: HU-INV-01 criterio 3 (negativo)
    Dado una persona de IT con sesión iniciada
    Cuando pide `POST /api/equipos` sin el campo `nombre`
    Entonces la API responde 400 con el mensaje «Falta el nombre del equipo» en el campo `error` y no se guarda ningún equipo

  @HU-INV-01-4 @negativo
  Escenario: HU-INV-01 criterio 4 (negativo)
    Dado una persona de IT con sesión iniciada y el equipo «Portátil 07» dado de alta
    Cuando da de alta un equipo con el nombre « portátil 07 », que solo se diferencia en mayúsculas y en espacios al principio y al final
    Entonces ve «Ya hay un equipo con ese nombre», la API responde 409 y la lista sigue con un solo «Portátil 07»
