# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-PRE-03
Característica: Ver qué equipos están prestados
  Como técnico de IT, quiero ver la lista de equipos con a quién está prestado cada uno y hasta cuándo, para no dar por libre un portátil que tiene otra persona.

  @HU-PRE-03-1 @positivo
  Escenario: HU-PRE-03 criterio 1 (positivo)
    Dado un técnico de IT con sesión iniciada, el equipo «Portátil 07» prestado a Ana Pérez hasta el 2026-11-20 y el equipo «Proyector sala 2» no prestado
    Cuando envía GET /api/equipos
    Entonces la aplicación responde 200 con dos equipos: «Portátil 07» con "prestado": true, "persona": "Ana Pérez" y "devolucion": "2026-11-20", y «Proyector sala 2» con "prestado": false

  @HU-PRE-03-2 @positivo
  Escenario: HU-PRE-03 criterio 2 (positivo)
    Dado un técnico de IT con sesión iniciada y el equipo «Proyector sala 2» no prestado
    Cuando envía GET /api/equipos
    Entonces «Proyector sala 2» aparece solo con id, "nombre": "Proyector sala 2" y "prestado": false, sin persona ni fecha de devolución

  @HU-PRE-03-3 @negativo
  Escenario: HU-PRE-03 criterio 3 (negativo)
    Dado un técnico de IT con sesión iniciada y el equipo «Portátil 07» ya devuelto tras un préstamo a Ana Pérez hasta el 2026-11-20
    Cuando envía GET /api/equipos
    Entonces «Portátil 07» aparece con "prestado": false y sin "persona" ni "devolucion" del préstamo anterior
