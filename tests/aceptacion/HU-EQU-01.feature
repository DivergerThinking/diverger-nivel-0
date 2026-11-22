# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-EQU-01
Característica: Dar de alta un equipo
  Como persona de IT, quiero dar de alta un equipo de la oficina con su nombre, para tener en un solo sitio todos los equipos que se pueden prestar, en lugar de una hoja de cálculo que nadie mantiene al día.

  @HU-EQU-01-1 @positivo
  Escenario: HU-EQU-01 criterio 1 (positivo)
    Dado una persona de IT con sesión iniciada y ningún equipo llamado «Portátil 07»
    Cuando da de alta el equipo con `POST /api/equipos` y `{"nombre": "Portátil 07"}`
    Entonces recibe 201 con `{"id": "…", "nombre": "Portátil 07", "prestado": false}` y el equipo aparece en la lista como no prestado

  @HU-EQU-01-2 @negativo
  Escenario: HU-EQU-01 criterio 2 (negativo)
    Dado una persona de IT con sesión iniciada
    Cuando da de alta un equipo con `{"nombre": ""}`
    Entonces recibe 400 con `{"error": "Falta el nombre del equipo"}` y no se da de alta ningún equipo

  @HU-EQU-01-3 @negativo
  Escenario: HU-EQU-01 criterio 3 (negativo)
    Dado una persona de IT con sesión iniciada
    Cuando da de alta un equipo con el cuerpo `{}`, sin nombre
    Entonces recibe 400 con `{"error": "Falta el nombre del equipo"}` y no se da de alta ningún equipo

  @HU-EQU-01-4 @negativo
  Escenario: HU-EQU-01 criterio 4 (negativo)
    Dado una persona de IT con sesión iniciada y el equipo «Portátil 07» ya dado de alta
    Cuando da de alta un equipo con `{"nombre": " portátil 07 "}`
    Entonces recibe 409 con `{"error": "Ya hay un equipo con ese nombre"}` y la lista sigue teniendo un solo «Portátil 07»
