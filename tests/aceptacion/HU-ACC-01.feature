# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-ACC-01
Característica: Entrar con la cuenta de Google
  Como técnico de IT, quiero entrar en la aplicación con mi cuenta de Google, para no tener que recordar otra contraseña para apuntar los préstamos.

  @HU-ACC-01-1 @positivo
  Escenario: HU-ACC-01 criterio 1 (positivo)
    Dado un técnico de IT sin sesión iniciada con una cuenta de Google de correo verificado
    Cuando entra con esa cuenta en la aplicación
    Entonces inicia sesión con un token de identidad emitido para el cliente OAuth de la aplicación y ve la lista de equipos de la oficina

  @HU-ACC-01-2 @negativo
  Escenario: HU-ACC-01 criterio 2 (negativo)
    Dado un token de identidad de Google con el correo sin verificar
    Cuando se envía en GET /api/equipos
    Entonces la aplicación responde 401 con {"error": "Inicia sesión con Google."} y no devuelve ningún equipo

  @HU-ACC-01-3 @negativo
  Escenario: HU-ACC-01 criterio 3 (negativo)
    Dado un token de identidad de Google con el correo verificado pero emitido para otro cliente OAuth
    Cuando se envía en GET /api/equipos
    Entonces la aplicación responde 401 con {"error": "Inicia sesión con Google."} y no devuelve ningún equipo
