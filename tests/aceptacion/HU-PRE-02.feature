# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-PRE-02
Característica: Validar la fecha de devolución
  Como persona de IT, quiero apuntar un préstamo con una fecha de devolución que existe, aunque ya haya pasado, para registrar con retraso los préstamos ya hechos sin guardar fechas imposibles.

  @HU-PRE-02-1 @positivo
  Escenario: HU-PRE-02 criterio 1 (positivo)
    Dado una persona de IT con sesión iniciada el 21 de noviembre de 2026 y el equipo «Proyector sala 2» sin prestar
    Cuando apunta el préstamo de «Proyector sala 2» a «Luis Gil» con la fecha pasada «2026-11-20»
    Entonces ve «Proyector sala 2» como prestado a «Luis Gil» hasta «2026-11-20» y la API responde 201 con `devolucion` «2026-11-20», en el mismo formato AAAA-MM-DD

  @HU-PRE-02-2 @negativo
  Escenario: HU-PRE-02 criterio 2 (negativo)
    Dado una persona de IT con sesión iniciada y el equipo «Proyector sala 2» sin prestar
    Cuando apunta el préstamo de «Proyector sala 2» a «Luis Gil» con la fecha «2026-02-30», que no existe
    Entonces ve «La fecha de devolución no es válida», la API responde 400 y «Proyector sala 2» sigue sin prestar
