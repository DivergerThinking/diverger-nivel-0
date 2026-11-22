// Lógica interna del contexto «prestamos»: los demás contextos no pueden importar este fichero.
import type { Almacen } from "../../lib/datos.js";
import { listarEquipos as listarEquiposDeEquipos } from "../equipos/index.js";
import type { components } from "./api.gen.js";

export type EquipoConEstado = components["schemas"]["Equipo"];

/** Préstamo activo tal como se guarda en `prestamos_activos`, con el identificador del equipo como id. */
export interface PrestamoActivo {
  persona: string;
  devolucion: string;
}

export const PRESTAMOS_ACTIVOS = "prestamos_activos";

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
