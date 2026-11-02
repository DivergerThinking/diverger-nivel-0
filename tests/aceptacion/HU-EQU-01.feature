# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-it/backlog.json. No se edita a mano: se regenera.

@HU-EQU-01
Característica: Dar de alta un equipo
  Como técnico de IT, quiero dar de alta un equipo de la oficina con su nombre, para que cada portátil o proyector figure en la lista antes de prestarlo.

  @HU-EQU-01-1 @positivo
  Escenario: HU-EQU-01 criterio 1 (positivo)
    Dado un técnico de IT con sesión iniciada y ningún equipo llamado «Portátil 07»
    Cuando envía POST /api/equipos con {"nombre": "Portátil 07"}
    Entonces recibe 201 con el id nuevo, "nombre": "Portátil 07" y "prestado": false, y «Portátil 07» aparece en GET /api/equipos

  @HU-EQU-01-2 @negativo
  Escenario: HU-EQU-01 criterio 2 (negativo)
    Dado un técnico de IT con sesión iniciada
    Cuando envía POST /api/equipos con {"nombre": ""}
    Entonces recibe 400 con {"error": "Falta el nombre del equipo"} y no se crea ningún equipo

  @HU-EQU-01-3 @negativo
  Escenario: HU-EQU-01 criterio 3 (negativo)
    Dado un técnico de IT con sesión iniciada
    Cuando envía POST /api/equipos con {}
    Entonces recibe 400 con {"error": "Falta el nombre del equipo"} y no se crea ningún equipo

  @HU-EQU-01-4 @negativo
  Escenario: HU-EQU-01 criterio 4 (negativo)
    Dado un técnico de IT con sesión iniciada y el equipo «Portátil 07» ya dado de alta
    Cuando envía POST /api/equipos con {"nombre": " portátil 07 "}
    Entonces recibe 409 con {"error": "Ya hay un equipo con ese nombre"} y sigue habiendo un solo «Portátil 07»
