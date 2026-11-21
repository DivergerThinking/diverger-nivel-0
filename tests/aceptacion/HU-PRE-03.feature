# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-PRE-03
Característica: Apuntar la devolución
  Como técnico de IT, quiero apuntar la devolución de un equipo cuando me lo devuelven, para que el equipo vuelva a aparecer como libre para el siguiente préstamo.

  @HU-PRE-03-1 @positivo
  Escenario: HU-PRE-03 criterio 1 (positivo)
    Dado un técnico de IT con sesión iniciada y el equipo «Portátil 07» prestado a «Ana Pérez» con devolución «2026-12-04»
    Cuando apunta la devolución de «Portátil 07»
    Entonces la API responde 200 con el equipo y `prestado: false`, y la lista muestra «Portátil 07» como no prestado, sin persona ni fecha

  @HU-PRE-03-2 @negativo
  Escenario: HU-PRE-03 criterio 2 (negativo)
    Dado el inventario de IT con un token válido y el equipo «Proyector sala 2» sin prestar
    Cuando llama a la ruta de devolución de «Proyector sala 2»
    Entonces recibe 409 con `{"error": "El equipo no está prestado"}` y «Proyector sala 2» sigue sin prestar

  @HU-PRE-03-3 @negativo
  Escenario: HU-PRE-03 criterio 3 (negativo)
    Dado el inventario de IT con un token válido y ningún equipo con el id «no-existe»
    Cuando llama a `POST /api/equipos/no-existe/devolucion`
    Entonces recibe 404 con `{"error": "No existe el equipo"}`
