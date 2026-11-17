// Interfaz pública del contexto «estado»: lo único que pueden importar los demás (ADR 0003).
import type { FastifyPluginAsync } from "fastify";
import "../../lib/auth.js";
import { consultarEstado } from "./estado.js";

export { consultarEstado, type Estado, type Resultado } from "./estado.js";

/** Rutas del contrato spec/contextos/estado/api.openapi.json. */
export const rutas: FastifyPluginAsync = (app) => {
  app.get("/api/estado", (request, reply) => {
    const { formato } = request.query as { formato?: string };
    const { codigo, cuerpo } = consultarEstado(formato);
    return reply.code(codigo).send(cuerpo);
  });
  return Promise.resolve();
};
