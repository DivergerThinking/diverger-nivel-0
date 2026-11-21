// Lógica interna del contexto: los demás contextos no pueden importar este fichero.
import type { Almacen } from "../../lib/datos.js";
import { listarEquipos, obtenerEquipo } from "../equipos/index.js";
import type { components } from "./api.gen.js";

export type EquipoConPrestamo = components["schemas"]["Equipo"];

/** Préstamo activo tal como se guarda: el id del documento es el del equipo. */
interface PrestamoActivo {
  persona: string;
  devolucion: string;
}

const PRESTAMOS_ACTIVOS = "prestamos_activos";

export const FALTAN_DATOS = "Faltan la persona o la fecha de devolución";
export const FECHA_NO_VALIDA = "La fecha de devolución no es válida";
export const NO_EXISTE_EL_EQUIPO = "No existe el equipo";
export const YA_ESTA_PRESTADO = "El equipo ya está prestado";

export const NO_ESTA_PRESTADO = "El equipo no está prestado";

export type ResultadoPrestamo =
  | { ok: true; equipo: EquipoConPrestamo }
  | { ok: false; status: 400 | 404 | 409; error: string };

/** Una fecha AAAA-MM-DD que existe en el calendario. */
function esFechaReal(texto: string): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (partes === null) return false;
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

/** Apunta el préstamo de un equipo a una persona hasta una fecha; un equipo tiene como mucho un préstamo activo. */
export async function prestarEquipo(almacen: Almacen, id: string, persona: unknown, devolucion: unknown): Promise<ResultadoPrestamo> {
  if (typeof persona !== "string" || persona.trim() === "" || typeof devolucion !== "string" || devolucion.trim() === "") {
    return { ok: false, status: 400, error: FALTAN_DATOS };
  }
  if (!esFechaReal(devolucion)) return { ok: false, status: 400, error: FECHA_NO_VALIDA };
  const equipo = await obtenerEquipo(almacen, id);
  if (equipo === undefined) return { ok: false, status: 404, error: NO_EXISTE_EL_EQUIPO };
  const yaPrestado = await almacen.transaccion(async (tx) => {
    if ((await tx.obtener<PrestamoActivo>(PRESTAMOS_ACTIVOS, id)) !== undefined) return true;
    tx.guardar(PRESTAMOS_ACTIVOS, id, { persona, devolucion });
    return false;
  });
  if (yaPrestado) return { ok: false, status: 409, error: YA_ESTA_PRESTADO };
  return { ok: true, equipo: { id: equipo.id, nombre: equipo.nombre, prestado: true, persona, devolucion } };
}

/** Apunta la devolución de un equipo: borra su préstamo activo y el equipo vuelve a estar libre. */
export async function devolverEquipo(almacen: Almacen, id: string): Promise<ResultadoPrestamo> {
  const equipo = await obtenerEquipo(almacen, id);
  if (equipo === undefined) return { ok: false, status: 404, error: NO_EXISTE_EL_EQUIPO };
  const estabaPrestado = await almacen.transaccion(async (tx) => {
    if ((await tx.obtener<PrestamoActivo>(PRESTAMOS_ACTIVOS, id)) === undefined) return false;
    tx.borrar(PRESTAMOS_ACTIVOS, id);
    return true;
  });
  if (!estabaPrestado) return { ok: false, status: 409, error: NO_ESTA_PRESTADO };
  return { ok: true, equipo: { id: equipo.id, nombre: equipo.nombre, prestado: false } };
}

/** Todos los equipos, cada uno con su préstamo solo si está prestado. */
export async function listarEquiposConPrestamo(almacen: Almacen): Promise<EquipoConPrestamo[]> {
  const equipos = await listarEquipos(almacen);
  return Promise.all(
    equipos.map(async (equipo): Promise<EquipoConPrestamo> => {
      const prestamo = await almacen.obtener<PrestamoActivo>(PRESTAMOS_ACTIVOS, equipo.id);
      if (prestamo === undefined) return { id: equipo.id, nombre: equipo.nombre, prestado: false };
      return { id: equipo.id, nombre: equipo.nombre, prestado: true, persona: prestamo.persona, devolucion: prestamo.devolucion };
    }),
  );
}
