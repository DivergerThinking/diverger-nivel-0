# language: es
# Generado por Diverger desde .diverger/prestamo-de-equipos-de-la-oficina/backlog.json. No se edita a mano: se regenera.

@HU-INV-02
Característica: Ver los equipos y sus préstamos
  Como persona de IT, quiero ver la lista de equipos con cuáles están prestados, a quién y hasta cuándo, para no dejar a nadie sin portátil por creer que un equipo está libre.

  @HU-INV-02-1 @positivo
  Escenario: HU-INV-02 criterio 1 (positivo)
    Dado una persona de IT con sesión iniciada, el equipo «Portátil 07» prestado a «Ana Pérez» con devolución «2026-11-20» y el equipo «Proyector sala 2» sin prestar
    Cuando abre la lista de equipos
    Entonces ve «Portátil 07» como prestado a «Ana Pérez» hasta «2026-11-20» y «Proyector sala 2» como no prestado; la API responde 200 con `id`, `nombre` y `prestado` de los dos equipos, y `persona` y `devolucion` solo en «Portátil 07»

  @HU-INV-02-2 @negativo
  Escenario: HU-INV-02 criterio 2 (negativo)
    Dado una persona de IT con sesión iniciada y ningún equipo dado de alta
    Cuando abre la lista de equipos
    Entonces ve la lista sin ningún equipo y la API responde 200 con una lista vacía
