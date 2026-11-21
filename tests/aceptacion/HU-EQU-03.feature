# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-EQU-03
Característica: Ver los equipos y a quién están prestados
  Como técnico de IT, quiero ver la lista de equipos con los que están prestados, a quién y hasta cuándo, para saber qué equipo está libre antes de prometérselo a alguien.

  @HU-EQU-03-1 @positivo
  Escenario: HU-EQU-03 criterio 1 (positivo)
    Dado un técnico de IT con sesión iniciada, el equipo «Portátil 07» prestado a «Ana Pérez» con devolución «2026-11-20» y el equipo «Proyector sala 2» sin prestar
    Cuando abre la lista de equipos
    Entonces ve «Portátil 07» como prestado a «Ana Pérez» hasta el «2026-11-20» y «Proyector sala 2» como no prestado

  @HU-EQU-03-2 @positivo
  Escenario: HU-EQU-03 criterio 2 (positivo)
    Dado el inventario de IT con un token válido y esos dos equipos
    Cuando llama a `GET /api/equipos`
    Entonces recibe 200 con dos equipos: «Portátil 07» con `id`, `nombre`, `prestado: true`, `persona: "Ana Pérez"` y `devolucion: "2026-11-20"`, y «Proyector sala 2» con `id`, `nombre` y `prestado: false`, sin `persona` ni `devolucion`

  @HU-EQU-03-3 @negativo
  Escenario: HU-EQU-03 criterio 3 (negativo)
    Dado una persona sin sesión iniciada
    Cuando abre la lista de equipos
    Entonces ve «Inicia sesión con Google.» y ningún equipo
