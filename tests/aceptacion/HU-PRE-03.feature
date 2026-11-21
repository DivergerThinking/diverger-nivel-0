# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-PRE-03
Característica: Apuntar la devolución de un equipo
  Como persona de IT, quiero apuntar la devolución de un equipo prestado, para que el equipo vuelva a figurar como libre y se pueda prestar a otra persona.

  @HU-PRE-03-1 @positivo
  Escenario: HU-PRE-03 criterio 1 (positivo)
    Dado una persona de IT con sesión iniciada y el equipo «Portátil 07» prestado a «Ana Pérez» con devolución «2026-11-20»
    Cuando apunta la devolución de «Portátil 07»
    Entonces ve «Portátil 07» como no prestado y la API responde 200 con el equipo y `prestado: false`

  @HU-PRE-03-2 @negativo
  Escenario: HU-PRE-03 criterio 2 (negativo)
    Dado una persona de IT con sesión iniciada y el equipo «Proyector sala 2» sin prestar
    Cuando apunta la devolución de «Proyector sala 2»
    Entonces ve «El equipo no está prestado», la API responde 409 y «Proyector sala 2» sigue sin prestar

  @HU-PRE-03-3 @negativo
  Escenario: HU-PRE-03 criterio 3 (negativo)
    Dado una persona de IT con sesión iniciada y ningún equipo con el id «eq-999»
    Cuando apunta la devolución del equipo «eq-999»
    Entonces ve «No existe el equipo» y la API responde 404
