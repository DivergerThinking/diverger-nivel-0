// Interfaz pública del contexto «ejemplo»: lo único que pueden importar los demás (ADR 0003).
// El arquitecto sustituye este contexto por los de la aplicación.
import type { FastifyPluginAsync } from "fastify";
import "../../lib/auth.js";
import { saludar } from "./saludo.js";

export { saludar, type Saludo } from "./saludo.js";

/** Rutas del contrato spec/contextos/ejemplo/api.openapi.json. */
export const rutas: FastifyPluginAsync = (app) => {
  app.get("/api/ejemplo/saludo", (request) => saludar(request.persona?.nombre ?? ""));
  return Promise.resolve();
};
