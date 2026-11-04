// Interfaz pública del contexto «estado»: lo único que pueden importar los demás (ADR 0003).
import type { FastifyPluginAsync } from "fastify";
import { ERROR_FORMATO, estadoDelServicio, formatoAdmitido } from "./estado.js";

/** Rutas del contrato spec/contextos/estado/api.openapi.json. */
export const rutas: FastifyPluginAsync = (app) => {
  app.get<{ Querystring: { formato?: string } }>("/api/estado", (request, reply) => {
    if (!formatoAdmitido(request.query.formato)) {
      return reply.code(400).send(ERROR_FORMATO);
    }
    return estadoDelServicio();
  });
  return Promise.resolve();
};
