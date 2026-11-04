# language: es
Característica: HU-AVI-02 Consultar el estado del servicio

  Escenario: HU-AVI-02 criterio 1 (positivo)
    Dado el servicio en marcha
    Cuando alguien envía GET /api/estado
    Entonces recibe 200 con {"estado": "en marcha"}

  Escenario: HU-AVI-02 criterio 2 (negativo)
    Dado el servicio en marcha
    Cuando alguien envía GET /api/estado?formato=xml
    Entonces recibe 400 con {"error": "Formato no admitido"}
