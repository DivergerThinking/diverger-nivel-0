# language: es
# Test de aceptación de prueba del bucle desatendido (HU-EJE-01).
@HU-002
Característica: Devolver un equipo

  Escenario: positivo
    Dado el equipo «Tienda 4 plazas»
    Cuando la socia Ana Pérez quiere devolver un equipo
    Entonces la aplicación lo permite
