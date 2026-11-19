# language: es
# Generado por Diverger desde .diverger/prestamos-de-equipos-de-it/backlog.json. No se edita a mano: se regenera.

@HU-ACC-02
Característica: Conectar el inventario de IT por la API
  Como inventario de IT, quiero usar la API del anexo con mi cuenta de servicio, para que el inventario de IT no deje de funcionar por un cambio de la API.

  @HU-ACC-02-1 @positivo
  Escenario: HU-ACC-02 criterio 1 (positivo)
    Dado el inventario de IT con un token de identidad de Google de su cuenta de servicio, con el correo verificado y emitido para el cliente OAuth de la aplicación, y una lista con el equipo «Portátil 07»
    Cuando envía `GET /api/equipos` con ese token
    Entonces recibe 200 con la lista de equipos, en la que está «Portátil 07»

  @HU-ACC-02-2 @negativo
  Escenario: HU-ACC-02 criterio 2 (negativo)
    Dado el inventario de IT con un token de identidad de Google de su cuenta de servicio, emitido para el cliente OAuth de la aplicación y con el correo sin verificar
    Cuando envía `GET /api/equipos` con ese token
    Entonces recibe 401 con `{"error": "Inicia sesión con Google."}` y ningún equipo

  @HU-ACC-02-3 @negativo
  Escenario: HU-ACC-02 criterio 3 (negativo)
    Dado el inventario de IT con un token válido de su cuenta de servicio y ningún equipo con el `id` «no-existe»
    Cuando envía `POST /api/equipos/no-existe/devolucion` con ese token
    Entonces recibe 404 con un objeto JSON cuyo único campo es `error`, con el valor «No existe el equipo»
