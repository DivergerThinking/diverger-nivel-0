// Interfaz pública del contexto «equipos»: lo único que pueden importar los demás (ADR 0003).
import type { FastifyPluginAsync } from "fastify";
import type { OpcionesContexto } from "../../lib/datos.js";
import "../../lib/auth.js";
import { listarEquipos } from "./equipos.js";

export { type Equipo } from "./equipos.js";

/** Rutas del contrato spec/contextos/equipos/api.openapi.json. El servidor ya exige el token en todas. */
export const rutas: FastifyPluginAsync<OpcionesContexto> = (app, { almacen }) => {
  app.get("/api/equipos", () => listarEquipos(almacen));
  return Promise.resolve();
};
