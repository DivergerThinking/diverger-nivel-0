// Lógica interna del contexto: los demás contextos no pueden importar este fichero.
import { randomUUID } from "node:crypto";
import type { Almacen } from "../../lib/datos.js";
import type { components } from "./api.gen.js";

export type EquipoCreado = components["schemas"]["EquipoCreado"];

/** Equipo tal como se guarda: el contexto no sabe si está prestado. */
export interface Equipo {
  id: string;
  nombre: string;
}

interface NombreGuardado {
  id: string;
}

export const FALTA_EL_NOMBRE = "Falta el nombre del equipo";
export const NOMBRE_REPETIDO = "Ya hay un equipo con ese nombre";

const EQUIPOS = "equipos_equipos";
const NOMBRES = "equipos_nombres";

export type ResultadoAlta =
  | { ok: true; equipo: EquipoCreado }
  | { ok: false; status: 400 | 409; error: string };

/** El nombre sin espacios al principio ni al final y en minúsculas: sirve solo para comparar nombres. */
export function normalizarNombre(nombre: string): string {
  return nombre.trim().toLowerCase();
}

/** Da de alta un equipo; rechaza el nombre vacío y el que repite el de otro equipo una vez normalizado. */
export async function crearEquipo(almacen: Almacen, nombre: unknown): Promise<ResultadoAlta> {
  if (typeof nombre !== "string" || normalizarNombre(nombre) === "") {
    return { ok: false, status: 400, error: FALTA_EL_NOMBRE };
  }
  const normalizado = normalizarNombre(nombre);
  const id = randomUUID();
  const repetido = await almacen.transaccion(async (tx) => {
    if ((await tx.obtener<NombreGuardado>(NOMBRES, normalizado)) !== undefined) return true;
    tx.guardar(NOMBRES, normalizado, { id });
    tx.guardar(EQUIPOS, id, { id, nombre });
    return false;
  });
  if (repetido) return { ok: false, status: 409, error: NOMBRE_REPETIDO };
  return { ok: true, equipo: { id, nombre, prestado: false } };
}

/** Todos los equipos dados de alta, en cualquier orden. */
export function listarEquipos(almacen: Almacen): Promise<Equipo[]> {
  return almacen.listar<Equipo>(EQUIPOS);
}

/** El equipo con ese id, o undefined si no existe. */
export function obtenerEquipo(almacen: Almacen, id: string): Promise<Equipo | undefined> {
  return almacen.obtener<Equipo>(EQUIPOS, id);
}
