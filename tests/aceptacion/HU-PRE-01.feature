# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-PRE-01
Característica: Prestar un equipo
  Como técnico de IT, quiero apuntar el préstamo de un equipo con la persona y la fecha en que lo tiene que devolver, para saber en todo momento quién tiene cada equipo y hasta cuándo, sin consultar una hoja de cálculo.

  @HU-PRE-01-1 @positivo
  Escenario: HU-PRE-01 criterio 1 (positivo)
    Dado un técnico de IT con sesión iniciada y el equipo «Portátil 07» no prestado
    Cuando envía POST /api/equipos/{id}/prestamo de «Portátil 07» con {"persona": "Ana Pérez", "devolucion": "2026-11-20"}
    Entonces la aplicación responde 201 con el equipo: su id, "nombre": "Portátil 07", "prestado": true, "persona": "Ana Pérez" y "devolucion": "2026-11-20"

  @HU-PRE-01-2 @negativo
  Escenario: HU-PRE-01 criterio 2 (negativo)
    Dado un técnico de IT con sesión iniciada y el equipo «Portátil 07» no prestado
    Cuando envía POST /api/equipos/{id}/prestamo de «Portátil 07» con {"persona": "Ana Pérez"}
    Entonces la aplicación responde 400 con {"error": "Faltan la persona o la fecha de devolución"} y «Portátil 07» sigue no prestado

  @HU-PRE-01-3 @negativo
  Escenario: HU-PRE-01 criterio 3 (negativo)
    Dado un técnico de IT con sesión iniciada y el equipo «Portátil 07» prestado a Ana Pérez hasta el 2026-11-20
    Cuando envía POST /api/equipos/{id}/prestamo de «Portátil 07» con {"persona": "Luis Gómez", "devolucion": "2026-11-25"}
    Entonces la aplicación responde 409 con {"error": "El equipo ya está prestado"} y el préstamo sigue a nombre de Ana Pérez hasta el 2026-11-20

  @HU-PRE-01-4 @negativo
  Escenario: HU-PRE-01 criterio 4 (negativo)
    Dado un técnico de IT con sesión iniciada y ningún equipo con el id «no-existe»
    Cuando envía POST /api/equipos/no-existe/prestamo con {"persona": "Ana Pérez", "devolucion": "2026-11-20"}
    Entonces la aplicación responde 404 con {"error": "No existe el equipo"}

  @HU-PRE-01-5 @negativo
  Escenario: HU-PRE-01 criterio 5 (negativo)
    Dado un técnico de IT con sesión iniciada y el equipo «Portátil 07» no prestado
    Cuando envía POST /api/equipos/{id}/prestamo de «Portátil 07» con {"persona": "Ana Pérez", "devolucion": "2026-02-30"}
    Entonces la aplicación responde 400 con {"error": "La fecha de devolución no es válida"} y «Portátil 07» sigue no prestado

  @HU-PRE-01-6 @negativo
  Escenario: HU-PRE-01 criterio 6 (negativo)
    Dado un técnico de IT con sesión iniciada y el equipo «Portátil 07» no prestado
    Cuando envía POST /api/equipos/{id}/prestamo de «Portátil 07» con {"persona": "Ana Pérez", "devolucion": "20/11/2026"}
    Entonces la aplicación responde 400 con {"error": "La fecha de devolución no es válida"} y «Portátil 07» sigue no prestado

  @HU-PRE-01-7 @positivo
  Escenario: HU-PRE-01 criterio 7 (positivo)
    Dado un técnico de IT con sesión iniciada, el equipo «Portátil 07» no prestado y hoy 2 de noviembre de 2026
    Cuando envía POST /api/equipos/{id}/prestamo de «Portátil 07» con {"persona": "Ana Pérez", "devolucion": "2026-10-15"}
    Entonces la aplicación responde 201 con "prestado": true, "persona": "Ana Pérez" y "devolucion": "2026-10-15"
