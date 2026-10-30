# language: es
# Test de aceptación de prueba del bucle desatendido (HU-EJE-01).
@HU-001
Característica: Prestar un equipo

  Escenario: positivo
    Dado el equipo «Tienda 4 plazas»
    Cuando la socia Ana Pérez quiere prestar un equipo
    Entonces la aplicación lo permite
