# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-PRE-02
Característica: Apuntar la devolución de un equipo
  Como equipo de IT, quiero apuntar la devolución de un equipo cuando lo devuelven, para que el equipo vuelva a constar como libre y se pueda prestar a otra persona.

  @HU-PRE-02-1 @positivo
  Escenario: HU-PRE-02 criterio 1 (positivo)
    Dado «Portátil 07» prestado a «Ana Pérez» hasta «2026-12-15»
    Cuando IT apunta su devolución
    Entonces recibe 200 con «Portátil 07» y prestado: false

  @HU-PRE-02-2 @negativo
  Escenario: HU-PRE-02 criterio 2 (negativo)
    Dado «Proyector sala 2» libre
    Cuando IT apunta su devolución
    Entonces recibe 409 con el error «El equipo no está prestado» y «Proyector sala 2» sigue libre

  @HU-PRE-02-3 @negativo
  Escenario: HU-PRE-02 criterio 3 (negativo)
    Dado una lista de equipos en la que no existe el identificador «zzz-999»
    Cuando IT apunta la devolución del equipo «zzz-999»
    Entonces recibe 404 con el error «No existe el equipo»
