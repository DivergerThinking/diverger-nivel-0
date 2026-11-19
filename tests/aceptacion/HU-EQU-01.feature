# language: es
# Generado por Diverger desde .diverger/prestamos-de-equipos-de-it/backlog.json. No se edita a mano: se regenera.

@HU-EQU-01
Característica: Dar de alta un equipo
  Como miembro del equipo de IT, quiero dar de alta un equipo de la oficina con su nombre, para tener en una sola lista todos los equipos que se pueden prestar.

  @HU-EQU-01-1 @positivo
  Escenario: HU-EQU-01 criterio 1 (positivo)
    Dado un miembro del equipo de IT con sesión iniciada y una lista sin ningún equipo llamado «Portátil 07»
    Cuando da de alta el equipo «Portátil 07»
    Entonces «Portátil 07» aparece en la lista como no prestado

  @HU-EQU-01-2 @positivo
  Escenario: HU-EQU-01 criterio 2 (positivo)
    Dado el inventario de IT con sesión iniciada y una lista sin ningún equipo llamado «Proyector sala 2»
    Cuando envía `POST /api/equipos` con `{"nombre": "Proyector sala 2"}`
    Entonces recibe 201 con el `id` del equipo, `nombre` «Proyector sala 2» y `prestado` `false`

  @HU-EQU-01-3 @negativo
  Escenario: HU-EQU-01 criterio 3 (negativo)
    Dado un miembro del equipo de IT con sesión iniciada y una lista con 2 equipos
    Cuando da de alta un equipo con el nombre vacío
    Entonces ve «Falta el nombre del equipo» y la lista sigue con 2 equipos

  @HU-EQU-01-4 @negativo
  Escenario: HU-EQU-01 criterio 4 (negativo)
    Dado el inventario de IT con sesión iniciada
    Cuando envía `POST /api/equipos` con `{}`
    Entonces recibe 400 con `{"error": "Falta el nombre del equipo"}` y no se guarda ningún equipo
