# language: es
# Test de aceptación de prueba del bucle desatendido (HU-EJE-01).
@HU-003
Característica: Ver los equipos disponibles

  Escenario: positivo
    Dado el equipo «Tienda 4 plazas»
    Cuando la socia Ana Pérez quiere ver los equipos disponibles
    Entonces la aplicación lo permite
