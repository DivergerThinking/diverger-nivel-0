# language: es
# Generado por Diverger desde .diverger/prestamos-de-equipos-de-it/backlog.json. No se edita a mano: se regenera.

@HU-PRE-02
Característica: Validar la fecha de devolución
  Como miembro del equipo de IT, quiero recibir un aviso al apuntar un préstamo con una fecha de devolución que no existe, para que la lista no muestre fechas de devolución imposibles.

  @HU-PRE-02-1 @negativo
  Escenario: HU-PRE-02 criterio 1 (negativo)
    Dado un miembro del equipo de IT con sesión iniciada y el equipo «Portátil 07» sin prestar
    Cuando apunta el préstamo de «Portátil 07» a «Ana Pérez» con devolución «2026-02-30»
    Entonces ve «La fecha de devolución no es válida» y «Portátil 07» sigue como no prestado

  @HU-PRE-02-2 @negativo
  Escenario: HU-PRE-02 criterio 2 (negativo)
    Dado el inventario de IT con sesión iniciada y el equipo «Portátil 07» sin prestar
    Cuando envía `POST /api/equipos/{id}/prestamo` con el `id` de «Portátil 07» y `{"persona": "Ana Pérez", "devolucion": "2026-02-30"}`
    Entonces recibe 400 con `{"error": "La fecha de devolución no es válida"}` y «Portátil 07» sigue como no prestado

  @HU-PRE-02-3 @positivo
  Escenario: HU-PRE-02 criterio 3 (positivo)
    Dado un miembro del equipo de IT con sesión iniciada el 19 de noviembre de 2026 y el equipo «Portátil 07» sin prestar
    Cuando apunta el préstamo de «Portátil 07» a «Ana Pérez» con devolución «2026-11-02», una fecha pasada
    Entonces «Portátil 07» pasa a figurar como prestado a «Ana Pérez» hasta «2026-11-02»
