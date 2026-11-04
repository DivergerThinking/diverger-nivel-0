// Lógica interna del contexto «estado»: los demás contextos no pueden importar este fichero.
import type { components, paths } from "./api.gen.js";

export type RespuestaEstado = paths["/api/estado"]["get"]["responses"][200]["content"]["application/json"];
export type ErrorEstado = components["schemas"]["Error"];

/** Formatos admitidos en ?formato=. Sin el parámetro, la respuesta es la de siempre. */
const FORMATOS_ADMITIDOS = new Set<string>(["json"]);

export const ERROR_FORMATO: ErrorEstado = { error: "Formato no admitido" };

export function formatoAdmitido(formato: string | undefined): boolean {
  return formato === undefined || FORMATOS_ADMITIDOS.has(formato);
}

export function estadoDelServicio(): RespuestaEstado {
  return { estado: "en marcha" };
}
