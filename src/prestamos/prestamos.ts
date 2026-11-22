// Lógica interna del contexto: los demás contextos no pueden importar este fichero.
import type { Almacen } from "../../lib/datos.js";
import { listarEquipos } from "../equipos/index.js";
import type { components } from "./api.gen.js";

export type EquipoConPrestamo = components["schemas"]["EquipoConPrestamo"];

/** Lo que se guarda de un préstamo activo en `prestamos_activos`. */
export interface PrestamoActivo {
  equipoId: string;
  persona: string;
  devolucion: string;
}

const PRESTAMOS_ACTIVOS = "prestamos_activos";

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
