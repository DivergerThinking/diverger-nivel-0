# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-EQU-01
Característica: Dar de alta un equipo
  Como equipo de IT, quiero dar de alta un equipo con su nombre, por ejemplo «Portátil 07», para tener en la lista todos los equipos de la oficina y que no se cuele uno repetido.

  @HU-EQU-01-1 @positivo
  Escenario: HU-EQU-01 criterio 1 (positivo)
    Dado una lista de equipos en la que no existe «Portátil 07»
    Cuando IT da de alta un equipo con el nombre «Portátil 07»
    Entonces recibe 201 con el equipo «Portátil 07», prestado: false y su identificador, y el equipo aparece en la lista

  @HU-EQU-01-2 @negativo
  Escenario: HU-EQU-01 criterio 2 (negativo)
    Dado una lista de equipos en la que no existe ninguno nuevo
    Cuando IT da de alta un equipo con el nombre vacío
    Entonces recibe 400 con el error «Falta el nombre del equipo» y no se crea ningún equipo

  @HU-EQU-01-3 @negativo
  Escenario: HU-EQU-01 criterio 3 (negativo)
    Dado una lista de equipos en la que no existe ninguno nuevo
    Cuando IT da de alta un equipo sin enviar el campo nombre
    Entonces recibe 400 con el error «Falta el nombre del equipo» y no se crea ningún equipo

  @HU-EQU-01-4 @negativo
  Escenario: HU-EQU-01 criterio 4 (negativo)
    Dado una lista de equipos en la que ya existe «Portátil 07»
    Cuando IT da de alta un equipo con el nombre « portátil 07 », en minúsculas y con espacios al principio y al final
    Entonces recibe 409 con el error «Ya hay un equipo con ese nombre» y la lista sigue teniendo un solo «Portátil 07»
