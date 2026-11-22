# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-PRE-02
Característica: Apuntar la devolución de un equipo
  Como persona de IT, quiero apuntar la devolución cuando me devuelven un equipo, para que el equipo vuelva a constar como libre y se pueda prestar a otra persona.

  @HU-PRE-02-1 @positivo
  Escenario: HU-PRE-02 criterio 1 (positivo)
    Dado una persona de IT con sesión iniciada y el equipo «Portátil 07» prestado a «Ana Pérez» hasta el 2026-11-20
    Cuando apunta la devolución con `POST /api/equipos/{id}/devolucion`
    Entonces recibe 200 con el equipo con `prestado: false` y la lista lo muestra sin `persona` ni `devolucion`

  @HU-PRE-02-2 @negativo
  Escenario: HU-PRE-02 criterio 2 (negativo)
    Dado una persona de IT con sesión iniciada y el equipo «Proyector sala 2» sin prestar
    Cuando apunta su devolución con `POST /api/equipos/{id}/devolucion`
    Entonces recibe 409 con `{"error": "El equipo no está prestado"}`

  @HU-PRE-02-3 @negativo
  Escenario: HU-PRE-02 criterio 3 (negativo)
    Dado una persona de IT con sesión iniciada y ningún equipo con el id «no-existe»
    Cuando apunta la devolución con `POST /api/equipos/no-existe/devolucion`
    Entonces recibe 404 con `{"error": "No existe el equipo"}`
