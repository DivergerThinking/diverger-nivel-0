# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-EQU-01
Característica: Dar de alta un equipo
  Como técnico de IT, quiero dar de alta un equipo de la oficina con su nombre, para tener en un solo sitio todos los equipos que se pueden prestar.

  @HU-EQU-01-1 @positivo
  Escenario: HU-EQU-01 criterio 1 (positivo)
    Dado un técnico de IT con sesión iniciada y ningún equipo llamado «Portátil 07»
    Cuando da de alta el equipo «Portátil 07»
    Entonces la API responde 201 con `{"id": "…", "nombre": "Portátil 07", "prestado": false}` y el equipo aparece en la lista como no prestado

  @HU-EQU-01-2 @negativo
  Escenario: HU-EQU-01 criterio 2 (negativo)
    Dado un técnico de IT con sesión iniciada
    Cuando da de alta un equipo con el nombre vacío
    Entonces la API responde 400 con `{"error": "Falta el nombre del equipo"}`, el técnico ve «Falta el nombre del equipo» y no se guarda ningún equipo

  @HU-EQU-01-3 @negativo
  Escenario: HU-EQU-01 criterio 3 (negativo)
    Dado el inventario de IT con un token válido
    Cuando llama a `POST /api/equipos` con `{}`
    Entonces recibe 400 con `{"error": "Falta el nombre del equipo"}`
