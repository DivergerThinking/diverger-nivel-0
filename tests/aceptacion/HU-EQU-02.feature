# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-it/backlog.json. No se edita a mano: se regenera.

@HU-EQU-02
Característica: Ver qué equipos están prestados
  Como técnico de IT, quiero ver todos los equipos y, de los prestados, a quién y hasta cuándo, para saber si un portátil está libre antes de comprometerlo con alguien.

  @HU-EQU-02-1 @positivo
  Escenario: HU-EQU-02 criterio 1 (positivo)
    Dado «Portátil 07» prestado a «Ana Pérez» hasta el 2026-11-20 y «Proyector sala 2» sin prestar
    Cuando un técnico de IT con sesión iniciada pide GET /api/equipos
    Entonces recibe 200 con «Portátil 07» con "prestado": true, "persona": "Ana Pérez" y "devolucion": "2026-11-20", y «Proyector sala 2» con "prestado": false y sin persona ni devolucion

  @HU-EQU-02-2 @positivo
  Escenario: HU-EQU-02 criterio 2 (positivo)
    Dado ningún equipo dado de alta
    Cuando un técnico de IT con sesión iniciada pide GET /api/equipos
    Entonces recibe 200 con la lista vacía []

  @HU-EQU-02-3 @negativo
  Escenario: HU-EQU-02 criterio 3 (negativo)
    Dado «Portátil 07» prestado a «Ana Pérez» y una petición sin token
    Cuando pide GET /api/equipos
    Entonces recibe 401 con {"error": "Inicia sesión con Google."} y no ve ningún equipo ni a quién está prestado
