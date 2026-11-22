# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-PRE-03
Característica: Validar la fecha de devolución
  Como equipo de IT, quiero apuntar préstamos con una fecha de devolución real, también si ya ha pasado, y recibir un error si la fecha no existe, para poder apuntar con retraso los préstamos sin guardar fechas imposibles.

  @HU-PRE-03-1 @positivo
  Escenario: HU-PRE-03 criterio 1 (positivo)
    Dado «Proyector sala 2» libre, con la fecha de hoy 22 de noviembre de 2026
    Cuando IT apunta su préstamo a «Luis Gómez» con devolución «2026-11-20», una fecha ya pasada
    Entonces recibe 201 con «Proyector sala 2», prestado: true y devolucion «2026-11-20»

  @HU-PRE-03-2 @negativo
  Escenario: HU-PRE-03 criterio 2 (negativo)
    Dado «Portátil 07» libre
    Cuando IT apunta su préstamo a «Ana Pérez» con la fecha «2026-02-30», que no existe
    Entonces recibe 400 con el error «La fecha de devolución no es válida» y «Portátil 07» sigue libre

  @HU-PRE-03-3 @negativo
  Escenario: HU-PRE-03 criterio 3 (negativo)
    Dado «Portátil 07» libre
    Cuando IT apunta su préstamo a «Ana Pérez» con la fecha «15/12/2026», que no está en formato AAAA-MM-DD
    Entonces recibe 400 con el error «La fecha de devolución no es válida» y «Portátil 07» sigue libre
