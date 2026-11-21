# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-EQU-02
Característica: Evitar equipos con el nombre repetido
  Como técnico de IT, quiero recibir un aviso cuando doy de alta un equipo con un nombre que ya existe, para no apuntar un préstamo en el equipo equivocado.

  @HU-EQU-02-1 @positivo
  Escenario: HU-EQU-02 criterio 1 (positivo)
    Dado un técnico de IT con sesión iniciada y el equipo «Portátil 07» dado de alta
    Cuando da de alta el equipo «Portátil 08»
    Entonces la API responde 201 y la lista muestra «Portátil 07» y «Portátil 08»

  @HU-EQU-02-2 @negativo
  Escenario: HU-EQU-02 criterio 2 (negativo)
    Dado un técnico de IT con sesión iniciada y el equipo «Portátil 07» dado de alta
    Cuando da de alta el equipo « portátil 07 », que solo se diferencia en mayúsculas y en espacios al principio y al final
    Entonces la API responde 409 con `{"error": "Ya hay un equipo con ese nombre"}`, el técnico ve «Ya hay un equipo con ese nombre» y la lista sigue con un solo «Portátil 07»
