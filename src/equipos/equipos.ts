// Lógica interna del contexto: los demás contextos no pueden importar este fichero.
import { randomUUID } from "node:crypto";
import type { Almacen, Lectura } from "../../lib/datos.js";
import type { components } from "./api.gen.js";

export type Equipo = components["schemas"]["Equipo"];

/** Lo que se guarda de un equipo en `equipos_equipos`. */
export interface EquipoGuardado {
  id: string;
  nombre: string;
  nombreNormalizado: string;
}

const EQUIPOS = "equipos_equipos";
const NOMBRES = "equipos_nombres";

export const FALTA_NOMBRE = "Falta el nombre del equipo";
export const NOMBRE_REPETIDO = "Ya hay un equipo con ese nombre";

/** Un fallo de la regla de negocio, con el código HTTP y el mensaje del contrato. */
export class ErrorDeEquipos extends Error {
  constructor(
    readonly status: 400 | 409,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorDeEquipos";
  }
}

/** El nombre sin espacios al principio ni al final y en minúsculas. */
export function normalizarNombre(nombre: string): string {
  return nombre.trim().toLowerCase();
}

/** Da de alta un equipo; el nombre se guarda tal como llega. */
export async function crearEquipo(almacen: Almacen, nombre: unknown): Promise<Equipo> {
  if (typeof nombre !== "string") throw new ErrorDeEquipos(400, FALTA_NOMBRE);
  const nombreNormalizado = normalizarNombre(nombre);
  if (nombreNormalizado === "") throw new ErrorDeEquipos(400, FALTA_NOMBRE);

  return almacen.transaccion(async (tx) => {
    if (await tx.obtener(NOMBRES, nombreNormalizado)) throw new ErrorDeEquipos(409, NOMBRE_REPETIDO);
    const id = randomUUID();
    const guardado: EquipoGuardado = { id, nombre, nombreNormalizado };
    tx.guardar(EQUIPOS, id, guardado);
    tx.guardar(NOMBRES, nombreNormalizado, { equipoId: id });
    return { id, nombre, prestado: false };
  });
}

/** El equipo con ese id, o undefined si no existe. */
export async function obtenerEquipo(lectura: Lectura, id: string): Promise<{ id: string; nombre: string } | undefined> {
  const guardado = await lectura.obtener<EquipoGuardado>(EQUIPOS, id);
  return guardado && { id: guardado.id, nombre: guardado.nombre };
}

/** Todos los equipos dados de alta, en cualquier orden. */
export async function listarEquipos(almacen: Almacen): Promise<{ id: string; nombre: string }[]> {
  const guardados = await almacen.listar<EquipoGuardado>(EQUIPOS);
  return guardados.map(({ id, nombre }) => ({ id, nombre }));
}
