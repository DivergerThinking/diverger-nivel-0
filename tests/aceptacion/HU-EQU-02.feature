# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-EQU-02
Característica: Ver qué equipos están prestados
  Como equipo de IT, quiero ver la lista de equipos con su estado, la persona que tiene cada uno prestado y la fecha de devolución, para saber en todo momento qué equipos están libres y evitar que alguien se quede sin portátil porque se creía libre.

  @HU-EQU-02-1 @positivo
  Escenario: HU-EQU-02 criterio 1 (positivo)
    Dado «Portátil 07» prestado a «Ana Pérez» hasta «2026-12-15» y «Proyector sala 2» libre
    Cuando IT consulta la lista de equipos
    Entonces recibe 200 con «Portátil 07» con prestado: true, persona «Ana Pérez» y devolucion «2026-12-15», y con «Proyector sala 2» con prestado: false

  @HU-EQU-02-2 @positivo
  Escenario: HU-EQU-02 criterio 2 (positivo)
    Dado «Portátil 07» que Ana Pérez acaba de devolver
    Cuando IT consulta la lista de equipos
    Entonces «Portátil 07» aparece con prestado: false y sin persona ni devolucion

  @HU-EQU-02-3 @negativo
  Escenario: HU-EQU-02 criterio 3 (negativo)
    Dado una lista en la que no se ha dado de alta ningún equipo
    Cuando IT consulta la lista de equipos
    Entonces recibe 200 con una lista vacía, sin ningún equipo
