// Lógica interna del contexto «prestamos»: los demás contextos no pueden importar este fichero.
import type { Almacen } from "../../lib/datos.js";
import { listarEquipos as listarEquiposDeEquipos, obtenerEquipo } from "../equipos/index.js";
import type { components } from "./api.gen.js";

export type EquipoConEstado = components["schemas"]["Equipo"];

/** Préstamo activo tal como se guarda en `prestamos_activos`, con el identificador del equipo como id. */
export interface PrestamoActivo {
  persona: string;
  devolucion: string;
}

export const PRESTAMOS_ACTIVOS = "prestamos_activos";

export const FALTAN_DATOS = "Faltan la persona o la fecha de devolución";
export const FECHA_NO_VALIDA = "La fecha de devolución no es válida";
export const NO_EXISTE_EL_EQUIPO = "No existe el equipo";
export const YA_PRESTADO = "El equipo ya está prestado";

/** Un fallo de la regla de negocio, con el código HTTP y el mensaje que fija el contrato. */
export class ErrorDePrestamos extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorDePrestamos";
  }
}

/** Si el texto es una fecha AAAA-MM-DD que existe. */
function esFechaReal(texto: string): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!partes) return false;
  const [anyo, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const fecha = new Date(Date.UTC(anyo, mes - 1, dia));
  return fecha.getUTCFullYear() === anyo && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

/**
 * Apunta el préstamo de un equipo. Lanza ErrorDePrestamos si falta la persona o la fecha (400), la fecha no existe (400),
 * el equipo no existe (404) o ya está prestado (409).
 */
export async function prestarEquipo(
  almacen: Almacen,
  id: string,
  persona: unknown,
  devolucion: unknown,
): Promise<EquipoConEstado> {
  if (typeof persona !== "string" || persona.trim() === "" || typeof devolucion !== "string" || devolucion.trim() === "") {
    throw new ErrorDePrestamos(400, FALTAN_DATOS);
  }
  const fecha = devolucion.trim();
  if (!esFechaReal(fecha)) throw new ErrorDePrestamos(400, FECHA_NO_VALIDA);
  const equipo = await obtenerEquipo(almacen, id);
  if (!equipo) throw new ErrorDePrestamos(404, NO_EXISTE_EL_EQUIPO);
  const prestatario = persona.trim();

  await almacen.transaccion(async (tx) => {
    const existente = await tx.obtener<PrestamoActivo>(PRESTAMOS_ACTIVOS, id);
    if (existente) throw new ErrorDePrestamos(409, YA_PRESTADO);
    tx.guardar(PRESTAMOS_ACTIVOS, id, { persona: prestatario, devolucion: fecha } satisfies PrestamoActivo);
  });

  return { id: equipo.id, nombre: equipo.nombre, prestado: true, persona: prestatario, devolucion: fecha };
}

/** Todos los equipos con su estado: de los prestados, también la persona y la fecha de devolución. */
export async function listarEquiposConEstado(almacen: Almacen): Promise<EquipoConEstado[]> {
  const equipos = await listarEquiposDeEquipos(almacen);
  const lista = await Promise.all(
    equipos.map(async (equipo): Promise<EquipoConEstado> => {
      const prestamo = await almacen.obtener<PrestamoActivo>(PRESTAMOS_ACTIVOS, equipo.id);
      return prestamo
        ? { id: equipo.id, nombre: equipo.nombre, prestado: true, persona: prestamo.persona, devolucion: prestamo.devolucion }
        : { id: equipo.id, nombre: equipo.nombre, prestado: false };
    }),
  );
  return lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
