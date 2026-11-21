// Lógica interna del contexto: los demás contextos no pueden importar este fichero.
import type { Almacen } from "../../lib/datos.js";
import { listarEquipos } from "../equipos/index.js";

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
