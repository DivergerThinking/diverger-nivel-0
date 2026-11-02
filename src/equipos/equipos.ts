// Lógica interna del contexto: los demás contextos no pueden importar este fichero.
import { randomUUID } from "node:crypto";
import type { Almacen } from "../../lib/datos.js";
import type { components } from "./api.gen.js";

export type Equipo = components["schemas"]["Equipo"];

export const COLECCION = "equipos";

export const ERROR_FALTA_NOMBRE = "Falta el nombre del equipo";

/** Documento de la colección «equipos». */
export interface DocumentoEquipo {
  nombre: string;
  /** Sin los espacios del principio y del final y sin distinguir mayúsculas; es lo que se compara. */
  nombreNormalizado: string;
  prestado: boolean;
  persona?: string;
  devolucion?: string;
}

export type ResultadoAlta = { ok: true; equipo: Equipo } | { ok: false; error: string };

export function normalizarNombre(nombre: string): string {
  return nombre.trim().toLowerCase();
}

/** Da de alta un equipo no prestado; sin nombre (o vacío) no crea nada. */
export async function darDeAlta(almacen: Almacen, nombre: unknown): Promise<ResultadoAlta> {
  if (typeof nombre !== "string" || normalizarNombre(nombre) === "") {
    return { ok: false, error: ERROR_FALTA_NOMBRE };
  }
  const id = randomUUID();
  const documento: DocumentoEquipo = { nombre, nombreNormalizado: normalizarNombre(nombre), prestado: false };
  await almacen.transaccion((tx) => {
    tx.guardar(COLECCION, id, documento);
    return Promise.resolve();
  });
  return { ok: true, equipo: { id, nombre, prestado: false } };
}
