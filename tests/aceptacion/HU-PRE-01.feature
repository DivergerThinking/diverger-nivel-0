# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-PRE-01
Característica: Apuntar el préstamo de un equipo
  Como persona de IT, quiero apuntar a quién presto un equipo y la fecha en que lo tiene que devolver, para saber quién tiene cada equipo y que no se pierda ninguno.

  @HU-PRE-01-1 @positivo
  Escenario: HU-PRE-01 criterio 1 (positivo)
    Dado una persona de IT con sesión iniciada y el equipo «Portátil 07» sin prestar
    Cuando lo presta con `POST /api/equipos/{id}/prestamo` y `{"persona": "Ana Pérez", "devolucion": "2026-11-20"}`
    Entonces recibe 201 con el equipo con `prestado: true`, `persona: "Ana Pérez"` y `devolucion: "2026-11-20"`, y la lista lo muestra prestado a «Ana Pérez» hasta el 2026-11-20

  @HU-PRE-01-2 @positivo
  Escenario: HU-PRE-01 criterio 2 (positivo)
    Dado una persona de IT con sesión iniciada, el 22 de noviembre de 2026, y el equipo «Proyector sala 2» sin prestar
    Cuando apunta con retraso su préstamo con `{"persona": "Luis Gómez", "devolucion": "2026-11-10"}`
    Entonces recibe 201 con `devolucion: "2026-11-10"`, porque una fecha pasada se acepta

  @HU-PRE-01-3 @positivo
  Escenario: HU-PRE-01 criterio 3 (positivo)
    Dado una persona de IT con sesión iniciada en la pantalla de IT y el equipo «Portátil 07» sin prestar
    Cuando apunta el préstamo a «Ana Pérez» con devolución el 2026-11-20
    Entonces el préstamo queda apuntado en menos de un minuto desde que abre el equipo

  @HU-PRE-01-4 @negativo
  Escenario: HU-PRE-01 criterio 4 (negativo)
    Dado una persona de IT con sesión iniciada y el equipo «Portátil 07» sin prestar
    Cuando lo presta con `{"persona": "Ana Pérez", "devolucion": "20/11/2026"}`
    Entonces recibe 400 con `{"error": "La fecha de devolución no es válida"}` y el equipo sigue sin prestar

  @HU-PRE-01-5 @negativo
  Escenario: HU-PRE-01 criterio 5 (negativo)
    Dado una persona de IT con sesión iniciada y el equipo «Portátil 07» sin prestar
    Cuando lo presta con `{"devolucion": "2026-11-20"}`, sin persona
    Entonces recibe 400 con `{"error": "Faltan la persona o la fecha de devolución"}` y el equipo sigue sin prestar

  @HU-PRE-01-6 @negativo
  Escenario: HU-PRE-01 criterio 6 (negativo)
    Dado una persona de IT con sesión iniciada y el equipo «Portátil 07» sin prestar
    Cuando lo presta con `{"persona": "Ana Pérez", "devolucion": "2026-02-30"}`
    Entonces recibe 400 con `{"error": "La fecha de devolución no es válida"}` y el equipo sigue sin prestar

  @HU-PRE-01-7 @negativo
  Escenario: HU-PRE-01 criterio 7 (negativo)
    Dado una persona de IT con sesión iniciada y ningún equipo con el id «no-existe»
    Cuando presta ese equipo con `POST /api/equipos/no-existe/prestamo` y `{"persona": "Ana Pérez", "devolucion": "2026-11-20"}`
    Entonces recibe 404 con `{"error": "No existe el equipo"}`

  @HU-PRE-01-8 @negativo
  Escenario: HU-PRE-01 criterio 8 (negativo)
    Dado una persona de IT con sesión iniciada y el equipo «Portátil 07» prestado a «Ana Pérez»
    Cuando lo presta con `{"persona": "Luis Gómez", "devolucion": "2026-12-01"}`
    Entonces recibe 409 con `{"error": "El equipo ya está prestado"}` y el préstamo a «Ana Pérez» no cambia
