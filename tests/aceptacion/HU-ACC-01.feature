# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-ACC-01
Característica: Entrar con la cuenta de Google de la empresa
  Como persona de IT, quiero entrar en la aplicación con mi cuenta de Google de la empresa, para usar la aplicación con la misma cuenta que ya uso en la empresa.

  @HU-ACC-01-1 @positivo
  Escenario: HU-ACC-01 criterio 1 (positivo)
    Dado una persona de IT con un token de identidad de Google de «it@empresa.example», con el correo verificado y emitido para el cliente OAuth de la aplicación
    Cuando pide la lista de equipos con `GET /api/equipos`
    Entonces recibe 200 con la lista de equipos

  @HU-ACC-01-2 @positivo
  Escenario: HU-ACC-01 criterio 2 (positivo)
    Dado el inventario de IT con un token de identidad de Google de su cuenta de servicio, con el correo verificado y emitido para el cliente OAuth de la aplicación
    Cuando pide la lista de equipos con `GET /api/equipos`
    Entonces recibe 200 con la lista de equipos

  @HU-ACC-01-3 @negativo
  Escenario: HU-ACC-01 criterio 3 (negativo)
    Dado una petición sin token
    Cuando llega a `POST /api/equipos` con `{"nombre": "Portátil 07"}`
    Entonces recibe 401 con `{"error": "Inicia sesión con Google."}` y no se da de alta ningún equipo

  @HU-ACC-01-4 @negativo
  Escenario: HU-ACC-01 criterio 4 (negativo)
    Dado un token de identidad de Google emitido para otro cliente OAuth
    Cuando pide la lista de equipos con `GET /api/equipos`
    Entonces recibe 401 con `{"error": "Inicia sesión con Google."}`

  @HU-ACC-01-5 @negativo
  Escenario: HU-ACC-01 criterio 5 (negativo)
    Dado un token de identidad de Google emitido para el cliente OAuth de la aplicación con el correo sin verificar
    Cuando pide la lista de equipos con `GET /api/equipos`
    Entonces recibe 401 con `{"error": "Inicia sesión con Google."}`
