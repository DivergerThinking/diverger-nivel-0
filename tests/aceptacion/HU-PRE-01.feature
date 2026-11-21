# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-PRE-01
Característica: Apuntar un préstamo
  Como técnico de IT, quiero apuntar el préstamo de un equipo con la persona y la fecha en que lo tiene que devolver, para saber a quién reclamar el equipo y cuándo.

  @HU-PRE-01-1 @positivo
  Escenario: HU-PRE-01 criterio 1 (positivo)
    Dado un técnico de IT con sesión iniciada y el equipo «Portátil 07» sin prestar
    Cuando apunta el préstamo de «Portátil 07» a «Ana Pérez» con devolución «2026-12-04»
    Entonces la API responde 201 con el equipo: `id`, `nombre`, `prestado: true`, `persona: "Ana Pérez"` y `devolucion: "2026-12-04"`, y la lista muestra «Portátil 07» prestado a «Ana Pérez» hasta el «2026-12-04»

  @HU-PRE-01-2 @negativo
  Escenario: HU-PRE-01 criterio 2 (negativo)
    Dado un técnico de IT con sesión iniciada y el equipo «Portátil 07» sin prestar
    Cuando apunta el préstamo de «Portátil 07» con devolución «2026-12-04» y la persona vacía
    Entonces la API responde 400 con `{"error": "Faltan la persona o la fecha de devolución"}`, el técnico ve ese mensaje y «Portátil 07» sigue sin prestar

  @HU-PRE-01-3 @negativo
  Escenario: HU-PRE-01 criterio 3 (negativo)
    Dado el equipo «Portátil 07» prestado a «Ana Pérez» con devolución «2026-12-04»
    Cuando un técnico de IT con sesión iniciada apunta el préstamo de «Portátil 07» a «Luis Gómez» con devolución «2026-12-11»
    Entonces la API responde 409 con `{"error": "El equipo ya está prestado"}` y «Portátil 07» sigue prestado a «Ana Pérez» hasta el «2026-12-04»

  @HU-PRE-01-4 @negativo
  Escenario: HU-PRE-01 criterio 4 (negativo)
    Dado el inventario de IT con un token válido y ningún equipo con el id «no-existe»
    Cuando llama a `POST /api/equipos/no-existe/prestamo` con `{"persona": "Ana Pérez", "devolucion": "2026-12-04"}`
    Entonces recibe 404 con `{"error": "No existe el equipo"}`
