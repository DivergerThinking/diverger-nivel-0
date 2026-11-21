# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-ACC-02
Característica: Conectar el inventario de IT con una cuenta de servicio
  Como inventario de IT, quiero llamar a la API con el token de identidad de mi cuenta de servicio, para acceder a la API de equipos sin que una persona inicie sesión.

  @HU-ACC-02-1 @positivo
  Escenario: HU-ACC-02 criterio 1 (positivo)
    Dado el inventario de IT con un token de identidad de Google de la cuenta de servicio «inventario@empresa.example», con el correo verificado y emitido para el cliente OAuth de la aplicación
    Cuando llama a `GET /api/equipos`
    Entonces recibe 200 con la lista de equipos

  @HU-ACC-02-2 @negativo
  Escenario: HU-ACC-02 criterio 2 (negativo)
    Dado un token de identidad de Google de esa cuenta de servicio emitido para otro cliente OAuth
    Cuando llama a `GET /api/equipos`
    Entonces recibe 401 con `{"error": "Inicia sesión con Google."}`

  @HU-ACC-02-3 @negativo
  Escenario: HU-ACC-02 criterio 3 (negativo)
    Dado un token de identidad de Google emitido para el cliente OAuth de la aplicación con el correo sin verificar
    Cuando llama a `GET /api/equipos`
    Entonces recibe 401 con `{"error": "Inicia sesión con Google."}`

  @HU-ACC-02-4 @negativo
  Escenario: HU-ACC-02 criterio 4 (negativo)
    Dado un token de identidad de Google de esa cuenta de servicio caducado
    Cuando llama a `POST /api/equipos` con `{"nombre": "Portátil 07"}`
    Entonces recibe 401 con `{"error": "Inicia sesión con Google."}` y no se guarda ningún equipo
