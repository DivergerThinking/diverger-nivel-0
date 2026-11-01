// Lógica interna del contexto: los demás contextos no pueden importar este fichero.
import type { components } from "./api.gen.js";

export type NuevoPrestamo = components["schemas"]["NuevoPrestamo"];
export type Prestamo = components["schemas"]["Prestamo"];

export class PrestamoError extends Error {
  constructor(
    readonly estado: 400 | 409,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

export interface Prestamos {
  prestar(datos: Partial<NuevoPrestamo>): Prestamo;
}

/** Préstamos en memoria: un equipo solo puede tener un préstamo activo. */
export function crearPrestamos(): Prestamos {
  const activos = new Map<string, Prestamo>();
  return {
    prestar(datos) {
      const equipo = datos.equipo?.trim() ?? "";
      const persona = datos.persona?.trim() ?? "";
      if (!equipo || !persona) throw new PrestamoError(400, "Faltan el equipo o la persona");
      if (activos.has(equipo)) throw new PrestamoError(409, "El equipo ya está prestado");
      const prestamo: Prestamo = { equipo, persona, activo: true };
      activos.set(equipo, prestamo);
      return prestamo;
    },
  };
}
