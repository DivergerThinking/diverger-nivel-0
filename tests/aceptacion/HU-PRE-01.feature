# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-PRE-01
Característica: Apuntar el préstamo de un equipo
  Como persona de IT, quiero apuntar a quién presto un equipo y la fecha en que lo tiene que devolver, para saber dónde está cada equipo y que no se pierda ninguno.

  @HU-PRE-01-1 @positivo
  Escenario: HU-PRE-01 criterio 1 (positivo)
    Dado una persona de IT con sesión iniciada y el equipo «Portátil 07» sin prestar
    Cuando apunta el préstamo de «Portátil 07» a «Ana Pérez» con devolución «2026-11-20»
    Entonces ve «Portátil 07» como prestado a «Ana Pérez» hasta «2026-11-20», la API responde 201 con `id`, `nombre`, `prestado: true`, `persona` y `devolucion`

  @HU-PRE-01-2 @positivo
  Escenario: HU-PRE-01 criterio 2 (positivo)
    Dado una persona de IT con sesión iniciada, en la lista de equipos, y el equipo «Proyector sala 2» sin prestar
    Cuando apunta el préstamo de «Proyector sala 2» a «Ana Pérez» con devolución «2026-11-20»
    Entonces apuntarlo no le cuesta más de un minuto: pasan menos de 60 segundos desde que empieza a apuntarlo en la lista hasta que ve «Proyector sala 2» como prestado

  @HU-PRE-01-3 @negativo
  Escenario: HU-PRE-01 criterio 3 (negativo)
    Dado una persona de IT con sesión iniciada y el equipo «Portátil 07» sin prestar
    Cuando apunta el préstamo de «Portátil 07» con devolución «2026-11-20» y sin persona
    Entonces ve «Faltan la persona o la fecha de devolución», la API responde 400 y «Portátil 07» sigue sin prestar

  @HU-PRE-01-4 @negativo
  Escenario: HU-PRE-01 criterio 4 (negativo)
    Dado una persona de IT con sesión iniciada y el equipo «Portátil 07» prestado a «Ana Pérez» con devolución «2026-11-20»
    Cuando apunta el préstamo de «Portátil 07» a «Luis Gil» con devolución «2026-11-27»
    Entonces ve «El equipo ya está prestado», la API responde 409 y «Portátil 07» sigue prestado a «Ana Pérez» hasta «2026-11-20»

  @HU-PRE-01-5 @negativo
  Escenario: HU-PRE-01 criterio 5 (negativo)
    Dado una persona de IT con sesión iniciada y ningún equipo con el id «eq-999»
    Cuando apunta el préstamo del equipo «eq-999» a «Ana Pérez» con devolución «2026-11-20»
    Entonces ve «No existe el equipo», la API responde 404 y no se guarda ningún préstamo
