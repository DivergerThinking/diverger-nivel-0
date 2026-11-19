// Lógica interna del contexto «equipos»: los demás contextos no pueden importar este fichero.
import { randomUUID } from "node:crypto";
import type { Almacen, Lectura } from "../../lib/datos.js";
import type { components } from "./api.gen.js";

export type EquipoCreado = components["schemas"]["EquipoCreado"];

/** Un equipo de la lista, tal como se guarda: sin nada de préstamos. */
export interface Equipo {
  id: string;
  nombre: string;
}

interface NombreGuardado {
  equipoId: string;
}

export const COLECCION_EQUIPOS = "equipos_equipos";
export const COLECCION_NOMBRES = "equipos_nombres";

export const FALTA_EL_NOMBRE = "Falta el nombre del equipo";
export const NOMBRE_REPETIDO = "Ya hay un equipo con ese nombre";

/** Resultado del alta: el equipo creado o el motivo por el que no se ha dado de alta. */
export type ResultadoAlta =
  | { ok: true; equipo: EquipoCreado }
  | { ok: false; status: 400 | 409; error: string };

/** El nombre sin espacios al principio ni al final y en minúsculas: sirve solo para comparar. */
export function normalizarNombre(nombre: string): string {
  return nombre.trim().toLowerCase();
}

/** Da de alta un equipo; el nombre normalizado y el equipo se guardan en una sola transacción. */
export async function darDeAlta(almacen: Almacen, nombre: unknown): Promise<ResultadoAlta> {
  if (typeof nombre !== "string" || nombre.trim() === "") {
    return { ok: false, status: 400, error: FALTA_EL_NOMBRE };
  }
  const normalizado = normalizarNombre(nombre);
  const equipo: Equipo = { id: randomUUID(), nombre };
  return almacen.transaccion<ResultadoAlta>(async (tx) => {
    if (await tx.obtener<NombreGuardado>(COLECCION_NOMBRES, normalizado)) {
      return { ok: false, status: 409, error: NOMBRE_REPETIDO };
    }
    tx.guardar(COLECCION_NOMBRES, normalizado, { equipoId: equipo.id } satisfies NombreGuardado);
    tx.guardar(COLECCION_EQUIPOS, equipo.id, equipo);
    return { ok: true, equipo: { id: equipo.id, nombre: equipo.nombre, prestado: false } };
  });
}

/** Todos los equipos de la lista. */
export function listarEquipos(lectura: Pick<Almacen, "listar">): Promise<Equipo[]> {
  return lectura.listar<Equipo>(COLECCION_EQUIPOS);
}

/** El equipo con ese id, o undefined si no existe. */
export function obtenerEquipo(lectura: Lectura, id: string): Promise<Equipo | undefined> {
  return lectura.obtener<Equipo>(COLECCION_EQUIPOS, id);
}
