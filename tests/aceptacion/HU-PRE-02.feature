# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-it/backlog.json. No se edita a mano: se regenera.

@HU-PRE-02
Característica: Comprobar la fecha de devolución
  Como técnico de IT, quiero apuntar un préstamo con una fecha de devolución pasada y corregir una fecha que no existe, para no dejar un préstamo con una fecha imposible y poder apuntar con retraso los que se olvidaron.

  @HU-PRE-02-1 @positivo
  Escenario: HU-PRE-02 criterio 1 (positivo)
    Dado un técnico de IT con sesión iniciada el 2 de noviembre de 2026 y «Portátil 07» sin prestar
    Cuando envía POST /api/equipos/{id de Portátil 07}/prestamo con {"persona": "Ana Pérez", "devolucion": "2026-10-30"}
    Entonces recibe 201 con "prestado": true, "persona": "Ana Pérez" y "devolucion": "2026-10-30"

  @HU-PRE-02-2 @negativo
  Escenario: HU-PRE-02 criterio 2 (negativo)
    Dado un técnico de IT con sesión iniciada y «Portátil 07» sin prestar
    Cuando envía POST /api/equipos/{id de Portátil 07}/prestamo con {"persona": "Ana Pérez", "devolucion": "2026-02-30"}
    Entonces recibe 400 con {"error": "La fecha de devolución no es válida"} y «Portátil 07» sigue sin prestar
