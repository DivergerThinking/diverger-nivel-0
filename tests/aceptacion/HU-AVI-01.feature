# language: es
Característica: HU-AVI-01 Mandar un aviso por correo

  Escenario: HU-AVI-01 criterio 1 (positivo)
    Dado un técnico de IT con sesión iniciada
    Cuando envía POST /api/avisos con {"para": "ana@example.com", "texto": "Devuelve el portátil"}
    Entonces el aviso se manda con nodemailer y recibe 202 con {"enviado": true}

  Escenario: HU-AVI-01 criterio 2 (negativo)
    Dado un técnico de IT con sesión iniciada
    Cuando envía POST /api/avisos con {"texto": "Devuelve el portátil"}
    Entonces recibe 400 con {"error": "Falta el destinatario"} y no se manda nada
