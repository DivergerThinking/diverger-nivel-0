# language: es
# Generado por Diverger desde .diverger/prestamos-de-equipos-de-it/backlog.json. No se edita a mano: se regenera.

@HU-PRE-01
Característica: Apuntar un préstamo
  Como miembro del equipo de IT, quiero apuntar el préstamo de un equipo con la persona y la fecha en que tiene que devolverlo, para que no se pierda ningún equipo por no saber quién lo tiene.

  @HU-PRE-01-1 @positivo
  Escenario: HU-PRE-01 criterio 1 (positivo)
    Dado un miembro del equipo de IT con sesión iniciada y el equipo «Portátil 07» sin prestar
    Cuando apunta el préstamo de «Portátil 07» a «Ana Pérez» con devolución «2026-11-20»
    Entonces «Portátil 07» pasa a figurar como prestado a «Ana Pérez» hasta «2026-11-20»

  @HU-PRE-01-2 @positivo
  Escenario: HU-PRE-01 criterio 2 (positivo)
    Dado el inventario de IT con sesión iniciada y el equipo «Portátil 07» sin prestar
    Cuando envía `POST /api/equipos/{id}/prestamo` con el `id` de «Portátil 07» y `{"persona": "Ana Pérez", "devolucion": "2026-11-20"}`
    Entonces recibe 201 con el equipo: `id`, `nombre` «Portátil 07», `prestado` `true`, `persona` «Ana Pérez» y `devolucion` «2026-11-20»

  @HU-PRE-01-3 @negativo
  Escenario: HU-PRE-01 criterio 3 (negativo)
    Dado un miembro del equipo de IT con sesión iniciada y el equipo «Portátil 07» sin prestar
    Cuando apunta el préstamo de «Portátil 07» con devolución «2026-11-20» y sin persona
    Entonces ve «Faltan la persona o la fecha de devolución» y «Portátil 07» sigue como no prestado

  @HU-PRE-01-4 @negativo
  Escenario: HU-PRE-01 criterio 4 (negativo)
    Dado un miembro del equipo de IT con sesión iniciada y el equipo «Portátil 07» prestado a «Ana Pérez» con devolución «2026-11-20»
    Cuando apunta el préstamo de «Portátil 07» a «Luis Gómez» con devolución «2026-11-27»
    Entonces ve «El equipo ya está prestado» y «Portátil 07» sigue prestado a «Ana Pérez» hasta «2026-11-20»

  @HU-PRE-01-5 @negativo
  Escenario: HU-PRE-01 criterio 5 (negativo)
    Dado el inventario de IT con sesión iniciada y ningún equipo con el `id` «no-existe»
    Cuando envía `POST /api/equipos/no-existe/prestamo` con `{"persona": "Ana Pérez", "devolucion": "2026-11-20"}`
    Entonces recibe 404 con `{"error": "No existe el equipo"}`
