# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-PRE-02
Característica: Apuntar la devolución de un equipo
  Como técnico de IT, quiero apuntar la devolución cuando le devuelven un equipo, para volver a prestarlo sin creer por error que sigue fuera.

  @HU-PRE-02-1 @positivo
  Escenario: HU-PRE-02 criterio 1 (positivo)
    Dado un técnico de IT con sesión iniciada y el equipo «Portátil 07» prestado a Ana Pérez hasta el 2026-11-20
    Cuando envía POST /api/equipos/{id}/devolucion de «Portátil 07»
    Entonces la aplicación responde 200 con el equipo «Portátil 07» y "prestado": false

  @HU-PRE-02-2 @negativo
  Escenario: HU-PRE-02 criterio 2 (negativo)
    Dado un técnico de IT con sesión iniciada y el equipo «Proyector sala 2» no prestado
    Cuando envía POST /api/equipos/{id}/devolucion de «Proyector sala 2»
    Entonces la aplicación responde 409 con {"error": "El equipo no está prestado"}

  @HU-PRE-02-3 @negativo
  Escenario: HU-PRE-02 criterio 3 (negativo)
    Dado un técnico de IT con sesión iniciada y ningún equipo con el id «no-existe»
    Cuando envía POST /api/equipos/no-existe/devolucion
    Entonces la aplicación responde 404 con {"error": "No existe el equipo"}
