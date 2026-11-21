// Lógica interna del contexto: los demás contextos no pueden importar este fichero.
import type { Almacen } from "../../lib/datos.js";
import { listarEquipos } from "../equipos/index.js";
import type { components } from "./api.gen.js";

export type EquipoConPrestamo = components["schemas"]["Equipo"];

/** Préstamo activo tal como se guarda: el id del documento es el del equipo. */
interface PrestamoActivo {
  persona: string;
  devolucion: string;
}

const PRESTAMOS_ACTIVOS = "prestamos_activos";

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
