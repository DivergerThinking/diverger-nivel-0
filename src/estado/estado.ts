// Lógica interna del contexto: los demás contextos no pueden importar este fichero.

export type Resultado = { codigo: 200; cuerpo: { estado: string } } | { codigo: 400; cuerpo: { error: string } };

export function consultarEstado(formato?: string): Resultado {
  if (formato !== undefined) {
    return { codigo: 400, cuerpo: { error: "Formato no admitido" } };
  }
  return { codigo: 200, cuerpo: { estado: "en marcha" } };
}
