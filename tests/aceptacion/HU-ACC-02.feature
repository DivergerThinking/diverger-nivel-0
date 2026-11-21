# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-ACC-02
Característica: Conectar el inventario de IT por la API
  Como inventario de IT, quiero consultar y actualizar los equipos por la API del anexo con una cuenta de servicio de Google, para seguir funcionando sin cambios mientras la API sea la que fijó el cliente.

  @HU-ACC-02-1 @positivo
  Escenario: HU-ACC-02 criterio 1 (positivo)
    Dado el inventario de IT con un token de identidad de su cuenta de servicio de Google, de correo verificado y emitido para el cliente OAuth de la aplicación, y el equipo «Portátil 07» dado de alta y sin prestar
    Cuando pide `GET /api/equipos`
    Entonces la API responde 200 con la lista de equipos, en la que «Portátil 07» trae `id`, `nombre` y `prestado: false`

  @HU-ACC-02-2 @positivo
  Escenario: HU-ACC-02 criterio 2 (positivo)
    Dado el inventario de IT con un token de identidad válido de su cuenta de servicio y ningún equipo llamado «Portátil 08»
    Cuando pide `POST /api/equipos` con el nombre «Portátil 08»
    Entonces la API responde 201 con el `id` del equipo, el `nombre` «Portátil 08» y `prestado: false`

  @HU-ACC-02-3 @positivo
  Escenario: HU-ACC-02 criterio 3 (positivo)
    Dado el inventario de IT con un token de identidad válido de su cuenta de servicio y el equipo «Portátil 07» sin prestar
    Cuando pide `POST /api/equipos/{id}/prestamo` de «Portátil 07» con la persona «Ana Pérez» y la devolución «2026-11-20»
    Entonces la API responde 201 con el equipo: `id`, `nombre`, `prestado: true`, `persona` «Ana Pérez» y `devolucion` «2026-11-20»

  @HU-ACC-02-4 @positivo
  Escenario: HU-ACC-02 criterio 4 (positivo)
    Dado el inventario de IT con un token de identidad válido de su cuenta de servicio y el equipo «Portátil 07» prestado a «Ana Pérez»
    Cuando pide `POST /api/equipos/{id}/devolucion` de «Portátil 07»
    Entonces la API responde 200 con el equipo y `prestado: false`

  @HU-ACC-02-5 @negativo
  Escenario: HU-ACC-02 criterio 5 (negativo)
    Dado el inventario de IT con un token de identidad de su cuenta de servicio emitido para un cliente OAuth distinto del de la aplicación
    Cuando pide `GET /api/equipos`
    Entonces la API responde 401 con el mensaje «Inicia sesión con Google.» en el campo `error` y sin ningún equipo
