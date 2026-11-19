# language: es
# Generado por Diverger desde .diverger/prestamos-de-equipos-de-it/backlog.json. No se edita a mano: se regenera.

@HU-PRE-03
Característica: Apuntar la devolución
  Como miembro del equipo de IT, quiero apuntar la devolución de un equipo prestado, para que el equipo vuelva a figurar como libre para el siguiente préstamo.

  @HU-PRE-03-1 @positivo
  Escenario: HU-PRE-03 criterio 1 (positivo)
    Dado un miembro del equipo de IT con sesión iniciada y el equipo «Portátil 07» prestado a «Ana Pérez» con devolución «2026-11-20»
    Cuando apunta la devolución de «Portátil 07»
    Entonces «Portátil 07» pasa a figurar como no prestado, sin persona ni fecha de devolución

  @HU-PRE-03-2 @positivo
  Escenario: HU-PRE-03 criterio 2 (positivo)
    Dado el inventario de IT con sesión iniciada y el equipo «Portátil 07» prestado a «Ana Pérez» con devolución «2026-11-20»
    Cuando envía `POST /api/equipos/{id}/devolucion` con el `id` de «Portátil 07»
    Entonces recibe 200 con el equipo «Portátil 07» y `prestado` `false`

  @HU-PRE-03-3 @negativo
  Escenario: HU-PRE-03 criterio 3 (negativo)
    Dado un miembro del equipo de IT con sesión iniciada y el equipo «Proyector sala 2» sin prestar
    Cuando apunta la devolución de «Proyector sala 2»
    Entonces ve «El equipo no está prestado» y «Proyector sala 2» sigue como no prestado

  @HU-PRE-03-4 @negativo
  Escenario: HU-PRE-03 criterio 4 (negativo)
    Dado el inventario de IT con sesión iniciada y ningún equipo con el `id` «no-existe»
    Cuando envía `POST /api/equipos/no-existe/devolucion`
    Entonces recibe 404 con `{"error": "No existe el equipo"}`
