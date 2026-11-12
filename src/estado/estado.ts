// Lógica interna del contexto: los demás contextos no pueden importar este fichero.
import type { components } from "./api.gen.js";

export type ErrorEstado = components["schemas"]["Error"];

export type ResultadoEstado = { codigo: 200; cuerpo: { estado: string } } | { codigo: 400; cuerpo: ErrorEstado };

export function consultarEstado(formato?: string): ResultadoEstado {
  if (formato !== undefined) {
    return { codigo: 400, cuerpo: { error: "Formato no admitido" } };
  }
  return { codigo: 200, cuerpo: { estado: "en marcha" } };
}
