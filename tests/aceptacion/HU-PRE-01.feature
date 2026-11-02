# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-it/backlog.json. No se edita a mano: se regenera.

@HU-PRE-01
Característica: Apuntar un préstamo
  Como técnico de IT, quiero apuntar el préstamo de un equipo con la persona y la fecha en que lo tiene que devolver, para saber en todo momento quién tiene cada equipo y no perder ninguno.

  @HU-PRE-01-1 @positivo
  Escenario: HU-PRE-01 criterio 1 (positivo)
    Dado un técnico de IT con sesión iniciada y «Portátil 07» sin prestar
    Cuando envía POST /api/equipos/{id de Portátil 07}/prestamo con {"persona": "Ana Pérez", "devolucion": "2026-11-20"}
    Entonces recibe 201 con el id, "nombre": "Portátil 07", "prestado": true, "persona": "Ana Pérez" y "devolucion": "2026-11-20"

  @HU-PRE-01-2 @negativo
  Escenario: HU-PRE-01 criterio 2 (negativo)
    Dado un técnico de IT con sesión iniciada y «Portátil 07» sin prestar
    Cuando envía POST /api/equipos/{id de Portátil 07}/prestamo con {"devolucion": "2026-11-20"}
    Entonces recibe 400 con {"error": "Faltan la persona o la fecha de devolución"} y «Portátil 07» sigue sin prestar

  @HU-PRE-01-3 @negativo
  Escenario: HU-PRE-01 criterio 3 (negativo)
    Dado un técnico de IT con sesión iniciada y «Portátil 07» sin prestar
    Cuando envía POST /api/equipos/{id de Portátil 07}/prestamo con {"persona": "Ana Pérez"}
    Entonces recibe 400 con {"error": "Faltan la persona o la fecha de devolución"} y «Portátil 07» sigue sin prestar

  @HU-PRE-01-4 @negativo
  Escenario: HU-PRE-01 criterio 4 (negativo)
    Dado un técnico de IT con sesión iniciada y ningún equipo con el id «no-existe»
    Cuando envía POST /api/equipos/no-existe/prestamo con {"persona": "Ana Pérez", "devolucion": "2026-11-20"}
    Entonces recibe 404 con {"error": "No existe el equipo"}

  @HU-PRE-01-5 @negativo
  Escenario: HU-PRE-01 criterio 5 (negativo)
    Dado un técnico de IT con sesión iniciada y «Portátil 07» prestado a «Ana Pérez» hasta el 2026-11-20
    Cuando envía POST /api/equipos/{id de Portátil 07}/prestamo con {"persona": "Luis Gómez", "devolucion": "2026-11-27"}
    Entonces recibe 409 con {"error": "El equipo ya está prestado"} y «Portátil 07» sigue prestado a «Ana Pérez» hasta el 2026-11-20
