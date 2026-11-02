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

/** Un documento por nombre normalizado en uso; su id es el nombre, así que solo cabe uno. */
export const COLECCION_NOMBRES = "equipos_nombres";

export const ERROR_NOMBRE_REPETIDO = "Ya hay un equipo con ese nombre";

export type ResultadoAlta =
  | { ok: true; equipo: Equipo }
  | { ok: false; error: string; repetido?: boolean };

export function normalizarNombre(nombre: string): string {
  return nombre.trim().toLowerCase();
}

/** Da de alta un equipo no prestado; sin nombre (o vacío) no crea nada. */
export async function darDeAlta(almacen: Almacen, nombre: unknown): Promise<ResultadoAlta> {
  if (typeof nombre !== "string" || normalizarNombre(nombre) === "") {
    return { ok: false, error: ERROR_FALTA_NOMBRE };
  }
  const id = randomUUID();
  const nombreNormalizado = normalizarNombre(nombre);
  const documento: DocumentoEquipo = { nombre, nombreNormalizado, prestado: false };
  // El nombre normalizado se reserva dentro de la misma transacción que crea el equipo: dos altas
  // simultáneas con el mismo nombre no pueden crear los dos.
  const reservado = await almacen.transaccion(async (tx) => {
    const idReserva = `n:${encodeURIComponent(nombreNormalizado)}`;
    if (await tx.obtener(COLECCION_NOMBRES, idReserva)) return false;
    tx.guardar(COLECCION_NOMBRES, idReserva, { equipoId: id });
    tx.guardar(COLECCION, id, documento);
    return true;
  });
  if (!reservado) return { ok: false, error: ERROR_NOMBRE_REPETIDO, repetido: true };
  return { ok: true, equipo: { id, nombre, prestado: false } };
}
