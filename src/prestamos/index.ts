// Interfaz pública del contexto «prestamos»: lo único que pueden importar los demás (ADR 0003).
import type { FastifyPluginAsync } from "fastify";
import type { OpcionesContexto } from "../../lib/datos.js";
import { devolverEquipo, ErrorDePrestamos, listarEquiposConEstado, prestarEquipo } from "./prestamos.js";

interface CuerpoDePrestamo {
  persona?: unknown;
  devolucion?: unknown;
}

/** Rutas del contrato spec/contextos/prestamos/api.openapi.json. El inicio de sesión lo exige el servidor en todo /api. */
export const rutas: FastifyPluginAsync<OpcionesContexto> = (app, { almacen }) => {
  app.get("/api/equipos", () => listarEquiposConEstado(almacen));

  app.post<{ Params: { id: string } }>("/api/equipos/:id/prestamo", async (request, reply) => {
    const cuerpo = (request.body ?? {}) as CuerpoDePrestamo;
    try {
      const equipo = await prestarEquipo(almacen, request.params.id, cuerpo.persona, cuerpo.devolucion);
      return await reply.code(201).send(equipo);
    } catch (motivo) {
      if (motivo instanceof ErrorDePrestamos) return reply.code(motivo.status).send({ error: motivo.message });
      throw motivo;
    }
  });

  app.post<{ Params: { id: string } }>("/api/equipos/:id/devolucion", async (request, reply) => {
    try {
      return await devolverEquipo(almacen, request.params.id);
    } catch (motivo) {
      if (motivo instanceof ErrorDePrestamos) return reply.code(motivo.status).send({ error: motivo.message });
      throw motivo;
    }
  });
  return Promise.resolve();
};
