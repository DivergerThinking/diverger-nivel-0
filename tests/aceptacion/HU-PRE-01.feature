# language: es
Característica: HU-PRE-01 Prestar un equipo

  Escenario: HU-PRE-01 criterio 1 (positivo)
    Dado el portátil «PC-07» disponible
    Cuando IT lo presta a Ana Pérez
    Entonces el préstamo queda activo a nombre de Ana Pérez y el equipo deja de estar disponible

  Escenario: HU-PRE-01 criterio 2 (negativo)
    Dado el portátil «PC-07» prestado a Luis Gil
    Cuando IT lo presta a Ana Pérez
    Entonces la aplicación responde «El equipo ya está prestado» y no crea el préstamo
