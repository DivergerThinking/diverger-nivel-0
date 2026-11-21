# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-ACC-01
Característica: Entrar con la cuenta de Google
  Como persona de IT, quiero entrar en la aplicación con mi cuenta de Google de la empresa, para que ninguna persona ni sistema sin sesión de Google pueda ver o cambiar los equipos.

  @HU-ACC-01-1 @positivo
  Escenario: HU-ACC-01 criterio 1 (positivo)
    Dado una persona de IT con la cuenta de Google «ana.perez@example.com», de correo verificado
    Cuando inicia sesión con Google en la aplicación
    Entonces ve la lista de equipos, y `GET /api/equipos` con su token de identidad responde 200

  @HU-ACC-01-2 @negativo
  Escenario: HU-ACC-01 criterio 2 (negativo)
    Dado una persona sin sesión iniciada
    Cuando pide `GET /api/equipos` sin token
    Entonces la API responde 401 con el mensaje «Inicia sesión con Google.» en el campo `error` y sin ningún equipo

  @HU-ACC-01-3 @negativo
  Escenario: HU-ACC-01 criterio 3 (negativo)
    Dado un token de identidad de Google emitido para un cliente OAuth distinto del de la aplicación
    Cuando se pide `GET /api/equipos` con ese token
    Entonces la API responde 401 con el mensaje «Inicia sesión con Google.» en el campo `error`

  @HU-ACC-01-4 @negativo
  Escenario: HU-ACC-01 criterio 4 (negativo)
    Dado un token de identidad de Google de una cuenta con el correo sin verificar
    Cuando se pide `POST /api/equipos` con ese token y el nombre «Portátil 08»
    Entonces la API responde 401 con el mensaje «Inicia sesión con Google.» en el campo `error` y no se guarda ningún equipo
