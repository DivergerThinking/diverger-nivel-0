# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-ACC-02
Característica: Rechazar llamadas a la API sin sesión
  Como técnico de IT, quiero bloquear las llamadas a la API que no traen un token válido, para que nadie sin sesión consulte ni cambie los equipos y sus préstamos.

  @HU-ACC-02-1 @positivo
  Escenario: HU-ACC-02 criterio 1 (positivo)
    Dado un cliente de la API con el token de identidad válido de un técnico de IT con sesión iniciada
    Cuando envía GET /api/equipos
    Entonces la aplicación responde 200 con la lista de equipos

  @HU-ACC-02-2 @positivo
  Escenario: HU-ACC-02 criterio 2 (positivo)
    Dado el inventario de IT con el token de identidad de su cuenta de servicio de Google, con el correo verificado y emitido para el cliente OAuth de la aplicación
    Cuando envía GET /api/equipos
    Entonces la aplicación responde 200 con la lista de equipos

  @HU-ACC-02-3 @negativo
  Escenario: HU-ACC-02 criterio 3 (negativo)
    Dado un cliente de la API sin token
    Cuando envía GET /api/equipos
    Entonces la aplicación responde 401 con {"error": "Inicia sesión con Google."} y no devuelve ningún equipo

  @HU-ACC-02-4 @negativo
  Escenario: HU-ACC-02 criterio 4 (negativo)
    Dado un cliente de la API con el token «token-no-valido»
    Cuando envía POST /api/equipos con {"nombre": "Portátil 09"}
    Entonces la aplicación responde 401 con {"error": "Inicia sesión con Google."} y no se crea el equipo «Portátil 09»

  @HU-ACC-02-5 @negativo
  Escenario: HU-ACC-02 criterio 5 (negativo)
    Dado un cliente de la API sin token y el equipo «Portátil 07» no prestado
    Cuando envía POST /api/equipos/{id}/prestamo de «Portátil 07» con {"persona": "Ana Pérez", "devolucion": "2026-11-20"}
    Entonces la aplicación responde 401 con {"error": "Inicia sesión con Google."} y «Portátil 07» sigue no prestado

  @HU-ACC-02-6 @negativo
  Escenario: HU-ACC-02 criterio 6 (negativo)
    Dado un cliente de la API sin token y el equipo «Portátil 07» prestado a Ana Pérez hasta el 2026-11-20
    Cuando envía POST /api/equipos/{id}/devolucion de «Portátil 07»
    Entonces la aplicación responde 401 con {"error": "Inicia sesión con Google."} y «Portátil 07» sigue prestado a Ana Pérez hasta el 2026-11-20
