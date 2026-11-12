# language: es
# Generado por Diverger desde .diverger/prueba-desatendido/backlog.json. No se edita a mano: se regenera.

@HU-AVI-02
Característica: Consultar el estado del servicio
  Como técnico de IT, quiero saber si el servicio está en marcha, para comprobarlo antes de prestar un equipo.

  @HU-AVI-02-1 @positivo
  Escenario: HU-AVI-02 criterio 1 (positivo)
    Dado el servicio en marcha
    Cuando alguien envía GET /api/estado
    Entonces recibe 200 con {"estado": "en marcha"}

  @HU-AVI-02-2 @negativo
  Escenario: HU-AVI-02 criterio 2 (negativo)
    Dado el servicio en marcha
    Cuando alguien envía GET /api/estado?formato=xml
    Entonces recibe 400 con {"error": "Formato no admitido"}
