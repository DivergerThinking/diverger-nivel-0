# language: es
# Generado por Diverger desde .diverger/prestamos-de-equipos-de-it/backlog.json. No se edita a mano: se regenera.

@HU-EQU-03
Característica: Ver qué equipos están prestados
  Como miembro del equipo de IT, quiero ver qué equipos están prestados, a quién y hasta cuándo, para saber si un equipo está libre antes de prestarlo y a quién reclamar los que faltan.

  @HU-EQU-03-1 @positivo
  Escenario: HU-EQU-03 criterio 1 (positivo)
    Dado un miembro del equipo de IT con sesión iniciada, el equipo «Portátil 07» prestado a «Ana Pérez» con devolución «2026-11-20» y el equipo «Proyector sala 2» sin prestar
    Cuando abre la lista de equipos
    Entonces ve «Portátil 07» como prestado a «Ana Pérez» hasta «2026-11-20» y «Proyector sala 2» como no prestado

  @HU-EQU-03-2 @positivo
  Escenario: HU-EQU-03 criterio 2 (positivo)
    Dado el inventario de IT con sesión iniciada, el equipo «Portátil 07» prestado a «Ana Pérez» con devolución «2026-11-20» y el equipo «Proyector sala 2» sin prestar
    Cuando envía `GET /api/equipos`
    Entonces recibe 200 con los 2 equipos: «Portátil 07» con `id`, `nombre`, `prestado` `true`, `persona` «Ana Pérez» y `devolucion` «2026-11-20», y «Proyector sala 2» con `id`, `nombre` y `prestado` `false`, sin `persona` ni `devolucion`

  @HU-EQU-03-3 @negativo
  Escenario: HU-EQU-03 criterio 3 (negativo)
    Dado una persona sin sesión iniciada
    Cuando abre la lista de equipos
    Entonces ve «Inicia sesión con Google.» y no ve ningún equipo ni ningún préstamo
