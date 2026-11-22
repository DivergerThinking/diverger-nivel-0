// Interfaz pública del contexto «prestamos»: sus rutas (ADR 0003 y 0004).
import type { FastifyPluginAsync } from "fastify";
import type { OpcionesContexto } from "../../lib/datos.js";
import type { components } from "./api.gen.js";
import { devolverEquipo, ErrorDePrestamos, listarEquiposConPrestamo, prestarEquipo } from "./prestamos.js";

type NuevoPrestamo = components["schemas"]["NuevoPrestamo"];

/** Rutas del contrato spec/contextos/prestamos/api.openapi.json. */
export const rutas: FastifyPluginAsync<OpcionesContexto> = (app, { almacen }) => {
  app.get("/api/equipos", () => listarEquiposConPrestamo(almacen));
  app.post<{ Params: { id: string } }>("/api/equipos/:id/prestamo", async (request, reply) => {
    const cuerpo = request.body as NuevoPrestamo | null | undefined;
    try {
      const equipo = await prestarEquipo(almacen, request.params.id, cuerpo?.persona, cuerpo?.devolucion);
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
