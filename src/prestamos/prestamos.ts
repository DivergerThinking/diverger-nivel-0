// Lógica interna del contexto «prestamos»: los demás contextos no pueden importar este fichero.
import type { Almacen } from "../../lib/datos.js";
import { listarEquipos, obtenerEquipo } from "../equipos/index.js";
import type { components } from "./api.gen.js";

export type EquipoConPrestamo = components["schemas"]["EquipoConPrestamo"];
export type EquipoPrestado = components["schemas"]["EquipoPrestado"];

export const FALTAN_DATOS = "Faltan la persona o la fecha de devolución";
export const FECHA_NO_VALIDA = "La fecha de devolución no es válida";
export const NO_EXISTE_EL_EQUIPO = "No existe el equipo";
export const YA_PRESTADO = "El equipo ya está prestado";

/** Resultado de prestar: el equipo prestado o el motivo por el que no se ha apuntado el préstamo. */
export type ResultadoPrestamo =
  | { ok: true; equipo: EquipoPrestado }
  | { ok: false; status: 400 | 404 | 409; error: string };

/** El préstamo activo de un equipo, tal como se guarda: el id del documento es el del equipo. */
export interface PrestamoActivo {
  equipoId: string;
  persona: string;
  devolucion: string;
}

export const COLECCION_PRESTAMOS = "prestamos_activos";

const hayTexto = (valor: unknown): valor is string => typeof valor === "string" && valor.trim() !== "";

/** Texto AAAA-MM-DD que es una fecha del calendario («2026-02-30» no lo es). Las fechas pasadas valen. */
export function esFechaQueExiste(texto: string): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!partes) return false;
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

/**
 * Apunta el préstamo de un equipo. Leer el equipo y el préstamo activo y guardar el nuevo van en una sola
 * transacción, para que dos peticiones a la vez no presten el mismo equipo dos veces.
 */
export async function prestarEquipo(
  almacen: Almacen,
  equipoId: string,
  persona: unknown,
  devolucion: unknown,
): Promise<ResultadoPrestamo> {
  if (!hayTexto(persona) || !hayTexto(devolucion)) {
    return { ok: false, status: 400, error: FALTAN_DATOS };
  }
  if (!esFechaQueExiste(devolucion)) {
    return { ok: false, status: 400, error: FECHA_NO_VALIDA };
  }
  return almacen.transaccion<ResultadoPrestamo>(async (tx) => {
    const equipo = await obtenerEquipo(tx, equipoId);
    if (!equipo) return { ok: false, status: 404, error: NO_EXISTE_EL_EQUIPO };
    if (await tx.obtener<PrestamoActivo>(COLECCION_PRESTAMOS, equipoId)) {
      return { ok: false, status: 409, error: YA_PRESTADO };
    }
    tx.guardar(COLECCION_PRESTAMOS, equipoId, { equipoId, persona, devolucion } satisfies PrestamoActivo);
    return { ok: true, equipo: { id: equipo.id, nombre: equipo.nombre, prestado: true, persona, devolucion } };
  });
}

/**
 * Todos los equipos con su estado: los prestados llevan persona y devolucion; los demás, solo id, nombre y
 * prestado false.
 */
export async function equiposConPrestamo(almacen: Almacen): Promise<EquipoConPrestamo[]> {
  const [equipos, prestamos] = await Promise.all([
    listarEquipos(almacen),
    almacen.listar<PrestamoActivo>(COLECCION_PRESTAMOS),
  ]);
  const porEquipo = new Map(prestamos.map((p) => [p.equipoId, p]));
  return equipos.map((equipo) => {
    const prestamo = porEquipo.get(equipo.id);
    return prestamo
      ? { id: equipo.id, nombre: equipo.nombre, prestado: true, persona: prestamo.persona, devolucion: prestamo.devolucion }
      : { id: equipo.id, nombre: equipo.nombre, prestado: false };
  });
}
