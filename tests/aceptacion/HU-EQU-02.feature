# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-EQU-02
Característica: Ver qué equipos están prestados
  Como persona de IT, quiero ver la lista de equipos con los que están prestados, a quién y hasta cuándo, para no dar por libre un portátil que tiene otra persona.

  @HU-EQU-02-1 @positivo
  Escenario: HU-EQU-02 criterio 1 (positivo)
    Dado una persona de IT con sesión iniciada, el equipo «Portátil 07» prestado a «Ana Pérez» hasta el 2026-11-20 y el equipo «Proyector sala 2» sin prestar
    Cuando pide la lista con `GET /api/equipos`
    Entonces recibe 200 con «Portátil 07» con `prestado: true`, `persona: "Ana Pérez"` y `devolucion: "2026-11-20"`, y con «Proyector sala 2» con `prestado: false`

  @HU-EQU-02-2 @negativo
  Escenario: HU-EQU-02 criterio 2 (negativo)
    Dado una persona de IT con sesión iniciada y el equipo «Proyector sala 2» sin prestar
    Cuando pide la lista con `GET /api/equipos`
    Entonces «Proyector sala 2» aparece solo con `id`, `nombre` y `prestado: false`, sin `persona` ni `devolucion`

  @HU-EQU-02-3 @negativo
  Escenario: HU-EQU-02 criterio 3 (negativo)
    Dado una petición sin token
    Cuando llega a `GET /api/equipos`
    Entonces recibe 401 con `{"error": "Inicia sesión con Google."}` y no ve ningún equipo
