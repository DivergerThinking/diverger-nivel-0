// Lógica interna del contexto: los demás contextos no pueden importar este fichero.
import type { Almacen } from "../../lib/datos.js";
import { listarEquipos, obtenerEquipo } from "../equipos/index.js";

/** El préstamo activo de un equipo, como se guarda en `prestamos_activos` con el id del equipo como id. */
export interface PrestamoActivo {
  persona: string;
  devolucion: string;
}

/** Un equipo con su préstamo: `persona` y `devolucion` solo si está prestado. */
export interface EquipoConPrestamo {
  id: string;
  nombre: string;
  prestado: boolean;
  persona?: string;
  devolucion?: string;
}

export const PRESTAMOS_ACTIVOS = "prestamos_activos";

export type ResultadoPrestamo =
  | { tipo: "prestado"; equipo: { id: string; nombre: string; persona: string; devolucion: string } }
  | { tipo: "faltan-datos" }
  | { tipo: "fecha-no-valida" }
  | { tipo: "no-existe" }
  | { tipo: "ya-prestado" };

/** Si el texto es una fecha real en formato AAAA-MM-DD. */
function esFechaReal(texto: string): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!partes) return false;
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

/**
 * Apunta el préstamo de un equipo. Comprueba los datos, que el equipo existe y, en una transacción, que no está
 * prestado ya (ADR 0002): como mucho un préstamo activo por equipo.
 */
export async function prestarEquipo(
  almacen: Almacen,
  idEquipo: string,
  persona: unknown,
  devolucion: unknown,
): Promise<ResultadoPrestamo> {
  if (typeof persona !== "string" || persona.trim() === "" || typeof devolucion !== "string" || devolucion.trim() === "") {
    return { tipo: "faltan-datos" };
  }
  if (!esFechaReal(devolucion)) return { tipo: "fecha-no-valida" };
  const equipo = await obtenerEquipo(almacen, idEquipo);
  if (!equipo) return { tipo: "no-existe" };
  return almacen.transaccion<ResultadoPrestamo>(async (tx) => {
    if (await tx.obtener<PrestamoActivo>(PRESTAMOS_ACTIVOS, equipo.id)) return { tipo: "ya-prestado" };
    const prestamo: PrestamoActivo = { persona, devolucion };
    tx.guardar(PRESTAMOS_ACTIVOS, equipo.id, prestamo);
    return { tipo: "prestado", equipo: { id: equipo.id, nombre: equipo.nombre, persona, devolucion } };
  });
}

/** Los equipos con su préstamo activo, si lo tienen. Lee sin transacción. */
export async function listarEquiposConPrestamo(almacen: Almacen): Promise<EquipoConPrestamo[]> {
  const equipos = await listarEquipos(almacen);
  return Promise.all(
    equipos.map(async (equipo): Promise<EquipoConPrestamo> => {
      const prestamo = await almacen.obtener<PrestamoActivo>(PRESTAMOS_ACTIVOS, equipo.id);
      if (!prestamo) return { id: equipo.id, nombre: equipo.nombre, prestado: false };
      return {
        id: equipo.id,
        nombre: equipo.nombre,
        prestado: true,
        persona: prestamo.persona,
        devolucion: prestamo.devolucion,
      };
    }),
  );
}
