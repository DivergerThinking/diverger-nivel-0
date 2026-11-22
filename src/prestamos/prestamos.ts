// Lógica interna del contexto: los demás contextos no pueden importar este fichero.
import type { Almacen } from "../../lib/datos.js";
import { listarEquipos, obtenerEquipo } from "../equipos/index.js";
import type { components } from "./api.gen.js";

export type EquipoConPrestamo = components["schemas"]["EquipoConPrestamo"];

/** Lo que se guarda de un préstamo activo en `prestamos_activos`. */
export interface PrestamoActivo {
  equipoId: string;
  persona: string;
  devolucion: string;
}

const PRESTAMOS_ACTIVOS = "prestamos_activos";

export const FALTAN_DATOS = "Faltan la persona o la fecha de devolución";
export const FECHA_NO_VALIDA = "La fecha de devolución no es válida";
export const NO_EXISTE_EL_EQUIPO = "No existe el equipo";
export const YA_PRESTADO = "El equipo ya está prestado";
export const NO_PRESTADO = "El equipo no está prestado";

/** Un fallo de la regla de negocio, con el código HTTP y el mensaje del contrato. */
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
function esFechaValida(texto: string): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!partes) return false;
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

/** Apunta el préstamo de un equipo; la fecha de devolución se guarda tal como llega y una fecha pasada se acepta. */
export async function prestarEquipo(
  almacen: Almacen,
  equipoId: string,
  persona: unknown,
  devolucion: unknown,
): Promise<EquipoConPrestamo> {
  if (typeof persona !== "string" || persona.trim() === "" || typeof devolucion !== "string" || devolucion.trim() === "") {
    throw new ErrorDePrestamos(400, FALTAN_DATOS);
  }
  if (!esFechaValida(devolucion)) throw new ErrorDePrestamos(400, FECHA_NO_VALIDA);

  return almacen.transaccion(async (tx) => {
    const equipo = await obtenerEquipo(tx, equipoId);
    if (!equipo) throw new ErrorDePrestamos(404, NO_EXISTE_EL_EQUIPO);
    if (await tx.obtener<PrestamoActivo>(PRESTAMOS_ACTIVOS, equipoId)) throw new ErrorDePrestamos(409, YA_PRESTADO);
    const prestamo: PrestamoActivo = { equipoId, persona, devolucion };
    tx.guardar(PRESTAMOS_ACTIVOS, equipoId, prestamo);
    return { id: equipo.id, nombre: equipo.nombre, prestado: true, persona, devolucion };
  });
}

/** Apunta la devolución de un equipo prestado: borra su préstamo activo y el equipo vuelve como libre. */
export async function devolverEquipo(almacen: Almacen, equipoId: string): Promise<EquipoConPrestamo> {
  return almacen.transaccion(async (tx) => {
    const equipo = await obtenerEquipo(tx, equipoId);
    if (!equipo) throw new ErrorDePrestamos(404, NO_EXISTE_EL_EQUIPO);
    if (!(await tx.obtener<PrestamoActivo>(PRESTAMOS_ACTIVOS, equipoId))) throw new ErrorDePrestamos(409, NO_PRESTADO);
    tx.borrar(PRESTAMOS_ACTIVOS, equipoId);
    return { id: equipo.id, nombre: equipo.nombre, prestado: false };
  });
}

/** Todos los equipos con su préstamo: los prestados llevan `persona` y `devolucion`, los libres no. */
export async function listarEquiposConPrestamo(almacen: Almacen): Promise<EquipoConPrestamo[]> {
  const [equipos, prestamos] = await Promise.all([listarEquipos(almacen), almacen.listar<PrestamoActivo>(PRESTAMOS_ACTIVOS)]);
  const porEquipo = new Map(prestamos.map((prestamo) => [prestamo.equipoId, prestamo]));
  return equipos.map(({ id, nombre }) => {
    const prestamo = porEquipo.get(id);
    return prestamo
      ? { id, nombre, prestado: true, persona: prestamo.persona, devolucion: prestamo.devolucion }
      : { id, nombre, prestado: false };
  });
}
