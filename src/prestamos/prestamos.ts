// Lógica interna del contexto «prestamos»: los demás contextos no pueden importar este fichero.
import type { Almacen } from "../../lib/datos.js";
import { listarEquipos } from "../equipos/index.js";
import type { components } from "./api.gen.js";

export type EquipoConPrestamo = components["schemas"]["EquipoConPrestamo"];

/** El préstamo activo de un equipo, tal como se guarda: el id del documento es el del equipo. */
export interface PrestamoActivo {
  equipoId: string;
  persona: string;
  devolucion: string;
}

export const COLECCION_PRESTAMOS = "prestamos_activos";

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
