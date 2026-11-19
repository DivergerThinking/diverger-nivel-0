# language: es
# Generado por Diverger desde .diverger/prestamos-de-equipos-de-it/backlog.json. No se edita a mano: se regenera.

@HU-EQU-02
Característica: Rechazar nombres de equipo repetidos
  Como miembro del equipo de IT, quiero recibir un aviso al dar de alta un equipo con un nombre que ya existe, para no tener el mismo equipo dos veces en la lista.

  @HU-EQU-02-1 @negativo
  Escenario: HU-EQU-02 criterio 1 (negativo)
    Dado un miembro del equipo de IT con sesión iniciada y una lista con el equipo «Portátil 07»
    Cuando da de alta el equipo « portátil 07 », en minúsculas y con un espacio al principio y otro al final
    Entonces ve «Ya hay un equipo con ese nombre» y la lista sigue con un solo «Portátil 07»

  @HU-EQU-02-2 @negativo
  Escenario: HU-EQU-02 criterio 2 (negativo)
    Dado el inventario de IT con sesión iniciada y una lista con el equipo «Portátil 07»
    Cuando envía `POST /api/equipos` con `{"nombre": "PORTÁTIL 07"}`
    Entonces recibe 409 con `{"error": "Ya hay un equipo con ese nombre"}` y no se guarda ningún equipo

  @HU-EQU-02-3 @positivo
  Escenario: HU-EQU-02 criterio 3 (positivo)
    Dado un miembro del equipo de IT con sesión iniciada y una lista con el equipo «Portátil 07»
    Cuando da de alta el equipo «Portátil 08»
    Entonces «Portátil 08» aparece en la lista como no prestado, junto a «Portátil 07»
