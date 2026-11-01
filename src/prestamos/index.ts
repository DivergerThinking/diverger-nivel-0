// Interfaz pública del contexto «prestamos»: lo único que pueden importar los demás (ADR 0003).
import type { FastifyPluginAsync } from "fastify";
import "../../lib/auth.js";
import { crearPrestamos, PrestamoError, type NuevoPrestamo } from "./prestamos.js";

export { crearPrestamos, PrestamoError, type Prestamo, type Prestamos } from "./prestamos.js";

/** Rutas del contrato spec/contextos/prestamos/api.openapi.json. */
export const rutas: FastifyPluginAsync = (app) => {
  const prestamos = crearPrestamos();
  app.post<{ Body: Partial<NuevoPrestamo> | null }>("/api/prestamos", (request, reply) => {
    try {
      return reply.code(201).send(prestamos.prestar(request.body ?? {}));
    } catch (error) {
      if (error instanceof PrestamoError) return reply.code(error.estado).send({ error: error.message });
      throw error;
    }
  });
  return Promise.resolve();
};
