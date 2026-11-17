// Lógica interna del contexto: los demás contextos no pueden importar este fichero.
import type { components } from "./api.gen.js";

export type Error = components["schemas"]["Error"];
export type Estado = { estado: string };

export type Resultado = { codigo: 200; cuerpo: Estado } | { codigo: 400; cuerpo: Error };

export function consultarEstado(formato?: string): Resultado {
  if (formato !== undefined) {
    return { codigo: 400, cuerpo: { error: "Formato no admitido" } };
  }
  return { codigo: 200, cuerpo: { estado: "en marcha" } };
}
