// Lógica interna del contexto «equipos»: los demás contextos no pueden importar este fichero.
import { randomUUID } from "node:crypto";
import type { Almacen } from "../../lib/datos.js";
import type { components } from "./api.gen.js";

export type EquipoCreado = components["schemas"]["EquipoCreado"];

/** Equipo tal como se guarda en `equipos_equipos`: el estado de préstamo no es de este contexto. */
export interface Equipo {
  id: string;
  nombre: string;
}

interface NombreGuardado {
  equipoId: string;
}

const EQUIPOS = "equipos_equipos";
const NOMBRES = "equipos_nombres";

export const FALTA_EL_NOMBRE = "Falta el nombre del equipo";
export const NOMBRE_REPETIDO = "Ya hay un equipo con ese nombre";

/** Un fallo de la regla de negocio, con el código HTTP y el mensaje que fija el contrato. */
export class ErrorDeEquipos extends Error {
  constructor(
    readonly status: 400 | 409,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorDeEquipos";
  }
}

/** Clave del nombre: el nombre sin espacios al principio ni al final y en minúsculas. */
export function claveDelNombre(nombre: string): string {
  return nombre.trim().toLowerCase();
}

/** Da de alta un equipo; lanza ErrorDeEquipos si falta el nombre o ya hay uno con esa clave. */
export async function crearEquipo(almacen: Almacen, nombre: unknown): Promise<EquipoCreado> {
  if (typeof nombre !== "string" || nombre.trim() === "") throw new ErrorDeEquipos(400, FALTA_EL_NOMBRE);
  const limpio = nombre.trim();
  const clave = claveDelNombre(limpio);
  const equipo: Equipo = { id: randomUUID(), nombre: limpio };

  await almacen.transaccion(async (tx) => {
    const existente = await tx.obtener<NombreGuardado>(NOMBRES, clave);
    if (existente) throw new ErrorDeEquipos(409, NOMBRE_REPETIDO);
    tx.guardar(EQUIPOS, equipo.id, equipo);
    tx.guardar(NOMBRES, clave, { equipoId: equipo.id } satisfies NombreGuardado);
  });

  return { id: equipo.id, nombre: equipo.nombre, prestado: false };
}

/** El equipo con ese identificador, o undefined si no existe. */
export function obtenerEquipo(almacen: Almacen, id: string): Promise<Equipo | undefined> {
  return almacen.obtener<Equipo>(EQUIPOS, id);
}

/** Todos los equipos dados de alta. */
export function listarEquipos(almacen: Almacen): Promise<Equipo[]> {
  return almacen.listar<Equipo>(EQUIPOS);
}
