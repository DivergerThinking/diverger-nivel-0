// Interfaz pública del contexto «estado»: lo único que pueden importar los demás (ADR 0003).
import type { FastifyPluginAsync } from "fastify";
import { consultarEstado } from "./estado.js";

export { consultarEstado, type ResultadoEstado } from "./estado.js";

/** Rutas del contrato spec/contextos/estado/api.openapi.json. */
export const rutas: FastifyPluginAsync = (app) => {
  app.get("/api/estado", (request, reply) => {
    const { formato } = request.query as { formato?: string };
    const resultado = consultarEstado(formato);
    return reply.code(resultado.codigo).send(resultado.cuerpo);
  });
  return Promise.resolve();
};
