# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-ACC-01
Característica: Entrar con la cuenta de Google de la empresa
  Como técnico de IT, quiero entrar en la aplicación con mi cuenta de Google de la empresa, para no tener que recordar otra contraseña para apuntar los préstamos.

  @HU-ACC-01-1 @positivo
  Escenario: HU-ACC-01 criterio 1 (positivo)
    Dado un técnico de IT sin sesión iniciada, con la cuenta de Google «ana.perez@empresa.example» y el correo verificado
    Cuando pulsa «Entrar con Google» y elige esa cuenta
    Entonces ve la aplicación con la sesión iniciada y el correo «ana.perez@empresa.example» en la cabecera

  @HU-ACC-01-2 @negativo
  Escenario: HU-ACC-01 criterio 2 (negativo)
    Dado una petición sin token de identidad
    Cuando llama a `GET /api/equipos`
    Entonces recibe 401 con `{"error": "Inicia sesión con Google."}` y ningún equipo
