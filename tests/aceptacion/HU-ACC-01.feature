# language: es
# Generado por Diverger desde .diverger/prestamos-de-equipos-de-it/backlog.json. No se edita a mano: se regenera.

@HU-ACC-01
Característica: Entrar con la cuenta de Google de la empresa
  Como miembro del equipo de IT, quiero entrar en la aplicación con mi cuenta de Google de la empresa, para no tener que recordar otra contraseña para apuntar los préstamos.

  @HU-ACC-01-1 @positivo
  Escenario: HU-ACC-01 criterio 1 (positivo)
    Dado un miembro del equipo de IT sin sesión iniciada, con la cuenta de Google de la empresa «it@empresa.example» y el correo verificado
    Cuando inicia sesión con esa cuenta de Google
    Entonces entra en la aplicación y ve la lista de equipos

  @HU-ACC-01-2 @negativo
  Escenario: HU-ACC-01 criterio 2 (negativo)
    Dado una persona sin sesión iniciada
    Cuando envía `GET /api/equipos` sin token
    Entonces recibe 401 con `{"error": "Inicia sesión con Google."}`

  @HU-ACC-01-3 @negativo
  Escenario: HU-ACC-01 criterio 3 (negativo)
    Dado una persona con un token de identidad de Google emitido para otro cliente OAuth distinto del de la aplicación
    Cuando envía `GET /api/equipos` con ese token
    Entonces recibe 401 con `{"error": "Inicia sesión con Google."}`

  @HU-ACC-01-4 @negativo
  Escenario: HU-ACC-01 criterio 4 (negativo)
    Dado una persona con un token de identidad de Google emitido para el cliente OAuth de la aplicación y con el correo sin verificar, y el equipo «Portátil 07» sin prestar
    Cuando envía `POST /api/equipos/{id}/prestamo` con el `id` de «Portátil 07», ese token y `{"persona": "Ana Pérez", "devolucion": "2026-11-20"}`
    Entonces recibe 401 con `{"error": "Inicia sesión con Google."}` y «Portátil 07» sigue como no prestado
