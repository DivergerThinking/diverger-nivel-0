# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-PRE-01
Característica: Apuntar un préstamo
  Como equipo de IT, quiero apuntar el préstamo de un equipo con la persona y la fecha en que tiene que devolverlo, para saber a quién reclamar cada equipo y que no se pierda ninguno.

  @HU-PRE-01-1 @positivo
  Escenario: HU-PRE-01 criterio 1 (positivo)
    Dado «Portátil 07» libre
    Cuando IT apunta su préstamo a «Ana Pérez» con devolución «2026-12-15»
    Entonces recibe 201 con «Portátil 07», prestado: true, persona «Ana Pérez» y devolucion «2026-12-15»

  @HU-PRE-01-2 @positivo
  Escenario: HU-PRE-01 criterio 2 (positivo)
    Dado el formulario de préstamo abierto con «Portátil 07» libre
    Cuando IT rellena la persona «Ana Pérez» y la fecha «2026-12-15» y confirma
    Entonces el préstamo consta apuntado y el tiempo desde abrir el formulario hasta la confirmación es de 60 segundos o menos

  @HU-PRE-01-3 @negativo
  Escenario: HU-PRE-01 criterio 3 (negativo)
    Dado «Portátil 07» libre
    Cuando IT apunta su préstamo con la fecha «2026-12-15» y sin persona
    Entonces recibe 400 con el error «Faltan la persona o la fecha de devolución» y «Portátil 07» sigue libre

  @HU-PRE-01-4 @negativo
  Escenario: HU-PRE-01 criterio 4 (negativo)
    Dado «Portátil 07» libre
    Cuando IT apunta su préstamo a «Ana Pérez» sin fecha de devolución
    Entonces recibe 400 con el error «Faltan la persona o la fecha de devolución» y «Portátil 07» sigue libre

  @HU-PRE-01-5 @negativo
  Escenario: HU-PRE-01 criterio 5 (negativo)
    Dado una lista de equipos en la que no existe el identificador «zzz-999»
    Cuando IT apunta un préstamo del equipo «zzz-999» a «Ana Pérez» con devolución «2026-12-15»
    Entonces recibe 404 con el error «No existe el equipo» y no se apunta ningún préstamo

  @HU-PRE-01-6 @negativo
  Escenario: HU-PRE-01 criterio 6 (negativo)
    Dado «Portátil 07» prestado a «Ana Pérez» hasta «2026-12-15»
    Cuando IT apunta su préstamo a «Luis Gómez» con devolución «2027-01-10»
    Entonces recibe 409 con el error «El equipo ya está prestado» y el préstamo a «Ana Pérez» no cambia
