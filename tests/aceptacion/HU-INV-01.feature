# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-INV-01
Característica: Dar de alta un equipo
  Como técnico de IT, quiero dar de alta un equipo con su nombre, para tener en la aplicación todos los equipos que se pueden prestar en lugar de una hoja de cálculo desactualizada.

  @HU-INV-01-1 @positivo
  Escenario: HU-INV-01 criterio 1 (positivo)
    Dado un técnico de IT con sesión iniciada y ningún equipo llamado «Portátil 07»
    Cuando envía POST /api/equipos con {"nombre": "Portátil 07"}
    Entonces la aplicación responde 201 con {"id": "…", "nombre": "Portátil 07", "prestado": false}

  @HU-INV-01-2 @negativo
  Escenario: HU-INV-01 criterio 2 (negativo)
    Dado un técnico de IT con sesión iniciada
    Cuando envía POST /api/equipos con {"nombre": ""}
    Entonces la aplicación responde 400 con {"error": "Falta el nombre del equipo"} y no se crea ningún equipo

  @HU-INV-01-3 @negativo
  Escenario: HU-INV-01 criterio 3 (negativo)
    Dado un técnico de IT con sesión iniciada
    Cuando envía POST /api/equipos con {}
    Entonces la aplicación responde 400 con {"error": "Falta el nombre del equipo"} y no se crea ningún equipo
