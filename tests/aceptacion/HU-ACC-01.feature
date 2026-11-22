# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-ACC-01
Característica: Exigir el inicio de sesión con Google
  Como equipo de IT, quiero iniciar sesión con la cuenta de Google de la empresa para usar la aplicación, igual que el inventario con su cuenta de servicio, para que nadie sin sesión de Google lea ni cambie el estado de los equipos.

  @HU-ACC-01-1 @positivo
  Escenario: HU-ACC-01 criterio 1 (positivo)
    Dado un token de identidad de Google de una persona, con el correo «it@empresa.example» verificado y emitido para el cliente OAuth de la aplicación
    Cuando IT pide la lista de equipos con ese token
    Entonces recibe 200 con la lista de equipos

  @HU-ACC-01-2 @positivo
  Escenario: HU-ACC-01 criterio 2 (positivo)
    Dado un token de identidad de Google de la cuenta de servicio del inventario, con el correo verificado y emitido para el cliente OAuth de la aplicación
    Cuando el inventario pide la lista de equipos con ese token
    Entonces recibe 200 con la lista de equipos

  @HU-ACC-01-3 @negativo
  Escenario: HU-ACC-01 criterio 3 (negativo)
    Dado una petición sin ningún token
    Cuando se pide la lista de equipos
    Entonces recibe 401 con el error «Inicia sesión con Google.» y ningún dato de equipos

  @HU-ACC-01-4 @negativo
  Escenario: HU-ACC-01 criterio 4 (negativo)
    Dado un token de identidad de Google cuyo correo «it@empresa.example» no está verificado
    Cuando se pide la lista de equipos con ese token
    Entonces recibe 401 con el error «Inicia sesión con Google.»

  @HU-ACC-01-5 @negativo
  Escenario: HU-ACC-01 criterio 5 (negativo)
    Dado un token de identidad de Google emitido para otro cliente OAuth distinto del de la aplicación
    Cuando se pide la lista de equipos con ese token
    Entonces recibe 401 con el error «Inicia sesión con Google.»
