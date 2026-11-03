// Interfaz pública del contexto «estado»: lo único que pueden importar los demás (ADR 0003).
import type { FastifyPluginAsync } from "fastify";
import "../../lib/auth.js";
import { consultarEstado } from "./estado.js";

export { consultarEstado, type Resultado } from "./estado.js";

/** Rutas del contrato spec/contextos/estado/api.openapi.json. */
export const rutas: FastifyPluginAsync = (app) => {
  app.get<{ Querystring: { formato?: string } }>("/api/estado", (request, reply) => {
    const resultado = consultarEstado(request.query.formato);
    return reply.code(resultado.codigo).send(resultado.cuerpo);
  });
  return Promise.resolve();
};
