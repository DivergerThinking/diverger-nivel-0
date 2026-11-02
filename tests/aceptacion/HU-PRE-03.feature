# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-it/backlog.json. No se edita a mano: se regenera.

@HU-PRE-03
Característica: Apuntar la devolución
  Como técnico de IT, quiero apuntar la devolución de un equipo cuando me lo devuelven, para que el equipo vuelva a figurar como libre y se pueda prestar a otra persona.

  @HU-PRE-03-1 @positivo
  Escenario: HU-PRE-03 criterio 1 (positivo)
    Dado un técnico de IT con sesión iniciada y «Portátil 07» prestado a «Ana Pérez» hasta el 2026-11-20
    Cuando envía POST /api/equipos/{id de Portátil 07}/devolucion
    Entonces recibe 200 con el equipo «Portátil 07» y "prestado": false, y en GET /api/equipos aparece sin persona ni devolucion

  @HU-PRE-03-2 @negativo
  Escenario: HU-PRE-03 criterio 2 (negativo)
    Dado un técnico de IT con sesión iniciada y «Proyector sala 2» sin prestar
    Cuando envía POST /api/equipos/{id de Proyector sala 2}/devolucion
    Entonces recibe 409 con {"error": "El equipo no está prestado"}

  @HU-PRE-03-3 @negativo
  Escenario: HU-PRE-03 criterio 3 (negativo)
    Dado un técnico de IT con sesión iniciada y ningún equipo con el id «no-existe»
    Cuando envía POST /api/equipos/no-existe/devolucion
    Entonces recibe 404 con {"error": "No existe el equipo"}
