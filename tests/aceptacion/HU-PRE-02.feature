# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-PRE-02
Característica: Validar la fecha de devolución
  Como técnico de IT, quiero recibir un aviso cuando apunto un préstamo con una fecha de devolución que no existe, para no dejar préstamos con una fecha que nadie puede cumplir.

  @HU-PRE-02-1 @positivo
  Escenario: HU-PRE-02 criterio 1 (positivo)
    Dado un técnico de IT con sesión iniciada el 21 de noviembre de 2026 y el equipo «Proyector sala 2» sin prestar
    Cuando apunta el préstamo de «Proyector sala 2» a «Ana Pérez» con devolución «2026-11-20», una fecha pasada
    Entonces la API responde 201 con `devolucion: "2026-11-20"` y la lista muestra «Proyector sala 2» prestado a «Ana Pérez» hasta el «2026-11-20»

  @HU-PRE-02-2 @negativo
  Escenario: HU-PRE-02 criterio 2 (negativo)
    Dado un técnico de IT con sesión iniciada y el equipo «Proyector sala 2» sin prestar
    Cuando apunta el préstamo de «Proyector sala 2» a «Ana Pérez» con devolución «2026-02-30», una fecha que no existe
    Entonces la API responde 400 con `{"error": "La fecha de devolución no es válida"}`, el técnico ve «La fecha de devolución no es válida» y «Proyector sala 2» sigue sin prestar

  @HU-PRE-02-3 @negativo
  Escenario: HU-PRE-02 criterio 3 (negativo)
    Dado el inventario de IT con un token válido y el equipo «Proyector sala 2» sin prestar
    Cuando llama a la ruta de préstamo de «Proyector sala 2» con `{"persona": "Ana Pérez", "devolucion": "20/11/2026"}`
    Entonces recibe 400 con `{"error": "La fecha de devolución no es válida"}`
