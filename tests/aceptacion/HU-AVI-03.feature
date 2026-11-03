# language: es
Característica: HU-AVI-03 Ver los avisos enviados

  Escenario: HU-AVI-03 criterio 1 (positivo)
    Dado un aviso mandado a ana@example.com
    Cuando envía GET /api/avisos
    Entonces recibe 200 con una lista que incluye el aviso a ana@example.com

  Escenario: HU-AVI-03 criterio 2 (negativo)
    Dado ningún aviso mandado
    Cuando envía GET /api/avisos
    Entonces recibe 200 con una lista vacía
