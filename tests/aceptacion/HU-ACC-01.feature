# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-it/backlog.json. No se edita a mano: se regenera.

@HU-ACC-01
Característica: Entrar con la cuenta de Google
  Como técnico de IT, quiero entrar en la aplicación con mi cuenta de Google de la empresa, para que nadie sin sesión iniciada pueda ver ni cambiar los préstamos.

  @HU-ACC-01-1 @positivo
  Escenario: HU-ACC-01 criterio 1 (positivo)
    Dado un técnico de IT con un token de identidad de Google de «tecnico@empresa.example», con el correo verificado y emitido para el cliente OAuth de la aplicación
    Cuando pide GET /api/equipos
    Entonces recibe 200 con la lista de equipos

  @HU-ACC-01-2 @positivo
  Escenario: HU-ACC-01 criterio 2 (positivo)
    Dado el inventario de IT con un token de identidad de Google de su cuenta de servicio, con el correo verificado y emitido para el cliente OAuth de la aplicación
    Cuando pide GET /api/equipos
    Entonces recibe 200 con la lista de equipos

  @HU-ACC-01-3 @negativo
  Escenario: HU-ACC-01 criterio 3 (negativo)
    Dado una petición sin token
    Cuando pide POST /api/equipos con {"nombre": "Portátil 07"}
    Entonces recibe 401 con {"error": "Inicia sesión con Google."} y no se crea ningún equipo

  @HU-ACC-01-4 @negativo
  Escenario: HU-ACC-01 criterio 4 (negativo)
    Dado un token de identidad de Google de «tecnico@empresa.example» emitido para otro cliente OAuth
    Cuando pide GET /api/equipos
    Entonces recibe 401 con {"error": "Inicia sesión con Google."}

  @HU-ACC-01-5 @negativo
  Escenario: HU-ACC-01 criterio 5 (negativo)
    Dado un token de identidad de Google emitido para el cliente OAuth de la aplicación, de una cuenta con el correo sin verificar
    Cuando pide GET /api/equipos
    Entonces recibe 401 con {"error": "Inicia sesión con Google."}
