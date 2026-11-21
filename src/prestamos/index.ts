// Interfaz pública del contexto «prestamos»: lo único que pueden importar los demás (ADR 0003).
import type { FastifyPluginAsync } from "fastify";
import "../../lib/auth.js";
import type { OpcionesContexto } from "../../lib/datos.js";
import { devolverEquipo, listarEquiposConPrestamo, prestarEquipo } from "./prestamos.js";

/** Rutas del contrato spec/contextos/prestamos/api.openapi.json. */
export const rutas: FastifyPluginAsync<OpcionesContexto> = (app, { almacen }) => {
  app.get("/api/equipos", async (_request, reply) => reply.code(200).send(await listarEquiposConPrestamo(almacen)));
  app.post<{ Params: { id: string } }>("/api/equipos/:id/prestamo", async (request, reply) => {
    const cuerpo = typeof request.body === "object" && request.body !== null ? (request.body as { persona?: unknown; devolucion?: unknown }) : {};
    const resultado = await prestarEquipo(almacen, request.params.id, cuerpo.persona, cuerpo.devolucion);
    if (!resultado.ok) return reply.code(resultado.status).send({ error: resultado.error });
    return reply.code(201).send(resultado.equipo);
  });
  app.post<{ Params: { id: string } }>("/api/equipos/:id/devolucion", async (request, reply) => {
    const resultado = await devolverEquipo(almacen, request.params.id);
    if (!resultado.ok) return reply.code(resultado.status).send({ error: resultado.error });
    return reply.code(200).send(resultado.equipo);
  });
  return Promise.resolve();
};
