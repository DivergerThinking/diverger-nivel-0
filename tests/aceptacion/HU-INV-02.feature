# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-INV-02
Característica: Impedir nombres de equipo repetidos
  Como técnico de IT, quiero dar de alta un equipo solo si ningún otro tiene su nombre, para no confundir dos equipos al apuntar a quién se ha prestado cada uno.

  @HU-INV-02-1 @positivo
  Escenario: HU-INV-02 criterio 1 (positivo)
    Dado un técnico de IT con sesión iniciada, el equipo «Portátil 07» ya dado de alta y ningún equipo llamado «Proyector sala 2»
    Cuando envía POST /api/equipos con {"nombre": "Proyector sala 2"}
    Entonces la aplicación responde 201 con {"id": "…", "nombre": "Proyector sala 2", "prestado": false} y la lista de equipos tiene «Portátil 07» y «Proyector sala 2»

  @HU-INV-02-2 @negativo
  Escenario: HU-INV-02 criterio 2 (negativo)
    Dado un técnico de IT con sesión iniciada y el equipo «Portátil 07» ya dado de alta
    Cuando envía POST /api/equipos con {"nombre": "Portátil 07"}
    Entonces la aplicación responde 409 con {"error": "Ya hay un equipo con ese nombre"} y la lista de equipos sigue teniendo un único «Portátil 07»

  @HU-INV-02-3 @negativo
  Escenario: HU-INV-02 criterio 3 (negativo)
    Dado un técnico de IT con sesión iniciada y el equipo «Portátil 07» ya dado de alta
    Cuando envía POST /api/equipos con {"nombre": "portátil 07 "}
    Entonces la aplicación responde 409 con {"error": "Ya hay un equipo con ese nombre"} y la lista de equipos sigue teniendo un único «Portátil 07»
